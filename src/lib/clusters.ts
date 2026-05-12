// Ingredient-first clustering using multi-signal affinity.
//
// Old approach (recipe-first) grouped recipes by shared matched ingredients,
// then derived "directions" from recipe membership. That made clusters depend
// on what was in the recipe corpus: if no Thai shrimp recipe existed, no Thai
// direction emerged even when shrimp + lime + lemongrass were obviously Thai.
// It also produced overly-specific labels like "Pork Chops with Apples".
//
// New approach: build a weighted graph on the SELECTED ingredients themselves,
// with edges encoding multi-signal affinity (curated pairings + flavor
// chemistry + cuisine overlap). Run greedy average-link agglomerative
// clustering. Label by dominant shared property (cuisine / category / anchor).
// Recipes attach to clusters as supporting evidence, not as the cause.

import seed from "../../data/ingredients.json";
import { compoundSimilarity } from "./compounds";
import type { Category, Ingredient, ScoredRecipe } from "./types";

interface SeedShape {
  ingredients: Ingredient[];
}

const data = seed as unknown as SeedShape;
const ingredientBySlug = new Map<string, Ingredient>(
  data.ingredients.map((i) => [i.slug, i])
);

export type LabelKind = "cuisine" | "category" | "anchor" | "mixed";

/** Shared color palette for cluster identity. Used to underline chips and
 *  outline cluster cards so the user can visually connect them. Limited to 6
 *  hues — a 7th cluster wraps. The first (pear green) matches the brand. */
export const CLUSTER_PALETTE = [
  "#1A7F37", // pear green
  "#B45309", // amber
  "#2563EB", // blue
  "#BE185D", // rose
  "#7C3AED", // violet
  "#0F766E", // teal
];

export function clusterColor(index: number): string {
  return CLUSTER_PALETTE[index % CLUSTER_PALETTE.length];
}

export interface IngredientCluster {
  id: string;
  /** Selected slugs that anchor this direction. */
  ingredients: string[];
  /** Human label. Source explained by labelKind. */
  label: string;
  labelKind: LabelKind;
  /** Dominant cuisine, when labelKind === "cuisine". */
  cuisine?: string;
  /** Recipes whose matched-ingredient signature aligns with this cluster. */
  recipes: ScoredRecipe[];
  /** Within-cluster total edge weight — for sort order and tie-breaks. */
  cohesion: number;
}

export interface SelectionAnalysis {
  clusters: IngredientCluster[];
  /** Selected slugs whose strongest edge to anything else is below threshold. */
  outliers: string[];
}

// --- Edge weights ------------------------------------------------------------

// Weights are tuned so that:
//  - a single classic curated pairing (strength=3) alone clears the merge bar
//  - chemistry alone (no curated link) can still merge if similarity is real
//  - cuisine alone doesn't merge — it reinforces other signals
const W_PAIR = 1.0;
const W_CHEM = 0.6;
const W_CUISINE = 0.3;

// Merge threshold: average-link edge strength required to merge two clusters.
// 0.34 lets a single strength-3 pairing (1.0) easily merge two singletons,
// and lets a moderate chem-similarity (~0.5) clear the bar too. But weaker
// signals (single strength-1 pair, low chem) stay apart.
const MERGE_THRESHOLD = 0.34;

// An ingredient is an outlier iff its strongest edge to any other selected
// ingredient is below this. Stricter than merge so a single weak edge keeps
// an ingredient "attached" but might not merge it into a multi-node cluster.
const OUTLIER_THRESHOLD = 0.18;

function pairingStrength(a: string, b: string): number {
  const ia = ingredientBySlug.get(a);
  if (!ia) return 0;
  const edge = ia.pairings.find((p) => p.slug === b);
  return edge ? edge.strength / 3 : 0;
}

function cuisineOverlap(a: string, b: string): number {
  const ia = ingredientBySlug.get(a);
  const ib = ingredientBySlug.get(b);
  if (!ia?.cuisines?.length || !ib?.cuisines?.length) return 0;
  const setA = new Set(ia.cuisines);
  let shared = 0;
  for (const c of ib.cuisines) if (setA.has(c)) shared++;
  const denom = Math.max(ia.cuisines.length, ib.cuisines.length, 1);
  return shared / denom;
}

/** Combined affinity, symmetric. Curated pairings are directional in our data
 *  so we take max of both directions. */
export function edgeWeight(a: string, b: string): number {
  if (a === b) return 0;
  const pair = Math.max(pairingStrength(a, b), pairingStrength(b, a));
  const chem = compoundSimilarity(a, b);
  const cui = cuisineOverlap(a, b);
  return W_PAIR * pair + W_CHEM * chem + W_CUISINE * cui;
}

// --- Clustering --------------------------------------------------------------

/** Average-link agglomerative clustering + a local-search refinement pass.
 *
 *  Agglomerative alone is order-dependent: the first merge bakes nodes into
 *  whatever cluster forms around their single strongest edge. Example: beef ↔
 *  blue-cheese is a stronger raw edge than beef ↔ mushroom, but beef's
 *  *average* affinity to the mushroom/onion/garlic/thyme cluster is much
 *  higher than to the pear/blue-cheese/walnut/honey/fig cluster. The
 *  refinement pass re-checks each node's best home and moves it if there's a
 *  meaningfully better fit.
 */
function cluster(slugs: string[]): string[][] {
  if (slugs.length === 0) return [];
  if (slugs.length === 1) return [[slugs[0]]];

  // Precompute pairwise edges.
  const edges = new Map<string, number>();
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const w = edgeWeight(slugs[i], slugs[j]);
      if (w > 0) edges.set(edgeKey(slugs[i], slugs[j]), w);
    }
  }

  function edgeOf(a: string, b: string): number {
    return edges.get(edgeKey(a, b)) ?? 0;
  }

  function avgLink(a: string[], b: string[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    let sum = 0;
    for (const x of a) for (const y of b) sum += edgeOf(x, y);
    return sum / (a.length * b.length);
  }

  let clusters: string[][] = slugs.map((s) => [s]);

  // Phase 1: greedy agglomerative.
  for (let pass = 0; pass < 100; pass++) {
    let bestI = -1;
    let bestJ = -1;
    let bestWeight = MERGE_THRESHOLD;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const w = avgLink(clusters[i], clusters[j]);
        if (w > bestWeight) {
          bestWeight = w;
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (bestI === -1) break;
    clusters[bestI] = [...clusters[bestI], ...clusters[bestJ]];
    clusters.splice(bestJ, 1);
  }

  // Phase 2: refinement. For each node, check whether some other cluster's
  // average link is higher than its current cluster's. If so, move it. Iterate
  // until stable.
  const REFINE_EPSILON = 0.05; // require meaningful improvement to move
  for (let iter = 0; iter < 20; iter++) {
    let moved = false;
    for (const slug of slugs) {
      // Locate current cluster.
      let curIdx = -1;
      for (let i = 0; i < clusters.length; i++) {
        if (clusters[i].includes(slug)) {
          curIdx = i;
          break;
        }
      }
      if (curIdx === -1) continue;
      const curCluster = clusters[curIdx];
      // Score against its own cluster (excluding self).
      const peers = curCluster.filter((s) => s !== slug);
      const curScore = avgLink([slug], peers); // 0 if it's alone

      let bestIdx = curIdx;
      let bestScore = curScore;
      for (let i = 0; i < clusters.length; i++) {
        if (i === curIdx) continue;
        const s = avgLink([slug], clusters[i]);
        if (s > bestScore + REFINE_EPSILON) {
          bestScore = s;
          bestIdx = i;
        }
      }
      if (bestIdx !== curIdx) {
        // Move slug from curCluster to clusters[bestIdx].
        clusters[curIdx] = curCluster.filter((s) => s !== slug);
        clusters[bestIdx] = [...clusters[bestIdx], slug];
        moved = true;
      }
    }
    // Drop empty clusters.
    clusters = clusters.filter((c) => c.length > 0);
    if (!moved) break;
  }

  // Phase 3: post-refinement, re-evaluate singletons. If a singleton's
  // avg-link to some cluster ≥ MERGE_THRESHOLD, fold it in.
  for (let iter = 0; iter < 5; iter++) {
    let changed = false;
    for (let i = clusters.length - 1; i >= 0; i--) {
      if (clusters[i].length !== 1) continue;
      const node = clusters[i][0];
      let bestIdx = -1;
      let bestScore = MERGE_THRESHOLD;
      for (let j = 0; j < clusters.length; j++) {
        if (j === i) continue;
        const s = avgLink([node], clusters[j]);
        if (s > bestScore) {
          bestScore = s;
          bestIdx = j;
        }
      }
      if (bestIdx !== -1) {
        clusters[bestIdx] = [...clusters[bestIdx], node];
        clusters.splice(i, 1);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return clusters;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}${b}` : `${b}${a}`;
}

function makeId(slugs: string[]): string {
  return [...slugs].sort().join("+");
}

function cohesionOf(slugs: string[]): number {
  if (slugs.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      sum += edgeWeight(slugs[i], slugs[j]);
    }
  }
  return sum;
}

// --- Labeling ----------------------------------------------------------------

const CATEGORY_LABELS: Record<Category, string> = {
  fruit: "Sweet fruit",
  vegetable: "Vegetable base",
  protein: "Savory protein",
  herb: "Aromatic herbs",
  spice: "Spice-forward",
  dairy: "Dairy + creamy",
  pantry: "Pantry build",
  nut: "Nutty",
  grain: "Grain-led",
  aromatic: "Aromatic base",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Find the cuisine that the most ingredients in this cluster share. */
function dominantCuisine(slugs: string[]): { cuisine: string; share: number } | null {
  const tally = new Map<string, number>();
  let withCuisine = 0;
  for (const s of slugs) {
    const ing = ingredientBySlug.get(s);
    if (!ing?.cuisines?.length) continue;
    withCuisine++;
    for (const c of ing.cuisines) tally.set(c, (tally.get(c) ?? 0) + 1);
  }
  if (withCuisine === 0) return null;
  let bestCuisine = "";
  let bestCount = 0;
  for (const [c, n] of tally) {
    if (n > bestCount) {
      bestCount = n;
      bestCuisine = c;
    }
  }
  if (bestCount < 2) return null;
  return { cuisine: bestCuisine, share: bestCount / slugs.length };
}

/** Find the dominant category in the cluster. */
function dominantCategory(
  slugs: string[]
): { category: Category; share: number } | null {
  const tally = new Map<Category, number>();
  for (const s of slugs) {
    const ing = ingredientBySlug.get(s);
    if (!ing) continue;
    tally.set(ing.category, (tally.get(ing.category) ?? 0) + 1);
  }
  let bestCategory: Category | null = null;
  let bestCount = 0;
  for (const [c, n] of tally) {
    if (n > bestCount) {
      bestCount = n;
      bestCategory = c;
    }
  }
  if (!bestCategory) return null;
  return { category: bestCategory, share: bestCount / slugs.length };
}

/** Pick the ingredient with the highest in-cluster connectivity. */
function anchorIngredient(slugs: string[]): string {
  if (slugs.length === 1) return slugs[0];
  let bestSlug = slugs[0];
  let bestWeight = -1;
  for (const s of slugs) {
    let sum = 0;
    for (const o of slugs) if (o !== s) sum += edgeWeight(s, o);
    if (sum > bestWeight) {
      bestWeight = sum;
      bestSlug = s;
    }
  }
  return bestSlug;
}

function labelCluster(slugs: string[]): {
  label: string;
  labelKind: LabelKind;
  cuisine?: string;
} {
  if (slugs.length === 1) {
    const ing = ingredientBySlug.get(slugs[0]);
    return { label: ing?.name ?? slugs[0], labelKind: "anchor" };
  }

  // Cuisine wins if at least half the ingredients (and ≥2) share one.
  const cuisine = dominantCuisine(slugs);
  if (cuisine && cuisine.share >= 0.5) {
    return {
      label: `${capitalize(cuisine.cuisine)}-leaning`,
      labelKind: "cuisine",
      cuisine: cuisine.cuisine,
    };
  }

  // Otherwise category if it's clearly dominant.
  const category = dominantCategory(slugs);
  if (category && category.share >= 0.6) {
    return {
      label: CATEGORY_LABELS[category.category],
      labelKind: "category",
    };
  }

  // Fallback: anchor-led.
  const anchorSlug = anchorIngredient(slugs);
  const anchor = ingredientBySlug.get(anchorSlug);
  return {
    label: `${anchor?.name ?? anchorSlug}-led`,
    labelKind: "anchor",
  };
}

// --- Recipe attachment -------------------------------------------------------

/** Attach matches to their best-fit cluster. A recipe joins a cluster iff its
 *  matchedRequired set has ≥30% overlap (Jaccard) with the cluster's
 *  ingredients. Each match goes to its single best-fit cluster. */
function attachRecipes(
  clusters: string[][],
  matches: ScoredRecipe[]
): Map<string, ScoredRecipe[]> {
  const out = new Map<string, ScoredRecipe[]>();
  for (const c of clusters) out.set(makeId(c), []);
  if (matches.length === 0) return out;

  for (const m of matches) {
    if (m.matchedRequired.length === 0) continue;
    let bestId: string | null = null;
    let bestScore = 0.3; // threshold
    const matchSet = new Set(m.matchedRequired);

    for (const c of clusters) {
      const clusterSet = new Set(c);
      let inter = 0;
      for (const s of matchSet) if (clusterSet.has(s)) inter++;
      const union = matchSet.size + clusterSet.size - inter;
      const sim = union > 0 ? inter / union : 0;
      if (sim > bestScore) {
        bestScore = sim;
        bestId = makeId(c);
      }
    }

    if (bestId) {
      const list = out.get(bestId) ?? [];
      list.push(m);
      out.set(bestId, list);
    }
  }

  // Sort each cluster's recipes by their original score (matches input order).
  for (const [id, list] of out) {
    list.sort((a, b) => b.score - a.score);
    out.set(id, list);
  }
  return out;
}

// --- Top-level ---------------------------------------------------------------

export function analyzeSelection(
  selectedSlugs: string[],
  matches: ScoredRecipe[]
): SelectionAnalysis {
  if (selectedSlugs.length === 0) return { clusters: [], outliers: [] };

  // Outliers are defined relative to OTHER ingredients in the selection — a
  // lone ingredient has nothing to be out of place against, so skip detection
  // when there's only one.
  const outliers: string[] = [];
  if (selectedSlugs.length >= 2) {
    for (const s of selectedSlugs) {
      let maxEdge = 0;
      for (const o of selectedSlugs) {
        if (o === s) continue;
        maxEdge = Math.max(maxEdge, edgeWeight(s, o));
      }
      if (maxEdge < OUTLIER_THRESHOLD) outliers.push(s);
    }
  }

  // Cluster the non-outliers. Outliers don't participate; that keeps weak
  // singletons out of the cluster strip and into the dedicated outliers row.
  const outlierSet = new Set(outliers);
  const clusterable = selectedSlugs.filter((s) => !outlierSet.has(s));
  const groups = cluster(clusterable).filter((g) => g.length > 0);

  // Suppress single-ingredient clusters when there are 2+ multi-ingredient
  // groups — they're noise next to real directions. Keep a single-ingredient
  // cluster only when it's the only group (i.e. the whole selection clusters
  // into one node, which means coherent selection of 1 or weak selection).
  const multi = groups.filter((g) => g.length > 1);
  const usedGroups =
    multi.length >= 2 || (multi.length === 1 && groups.length > 1)
      ? multi
      : groups;

  const recipeAttachments = attachRecipes(usedGroups, matches);

  const clusters: IngredientCluster[] = usedGroups
    .map((g) => {
      const ings = [...g].sort();
      const labeled = labelCluster(g);
      return {
        id: makeId(ings),
        ingredients: ings,
        recipes: recipeAttachments.get(makeId(ings)) ?? [],
        cohesion: cohesionOf(g),
        ...labeled,
      };
    })
    .sort((a, b) => b.cohesion - a.cohesion);

  return { clusters, outliers };
}

/** Show the strip when there's actual signal: ≥2 clusters, or ≥1 outlier. */
export function shouldShowClusters(analysis: SelectionAnalysis): boolean {
  if (analysis.clusters.length >= 2) return true;
  if (analysis.outliers.length > 0) return true;
  return false;
}

// --- Alternates --------------------------------------------------------------
// "Alternate directions" are recipes a user is partway to that aren't already
// represented by the main clusters. Surfaces, for example, Thai recipes when
// shrimp + chili + onion are present in a chicken-leaning selection.

export function findAlternates(
  broadMatches: ScoredRecipe[],
  clusters: IngredientCluster[],
  limit = 4
): ScoredRecipe[] {
  if (broadMatches.length === 0) return [];

  const clusterSets = clusters.map((c) => new Set(c.ingredients));

  function isCovered(match: ScoredRecipe): boolean {
    // A match is "covered" iff its matched signature would attach to a cluster
    // under the same 0.4 Jaccard threshold the recipe-attachment uses.
    const matchSet = new Set(match.matchedRequired);
    for (const clusterSet of clusterSets) {
      let inter = 0;
      for (const s of matchSet) if (clusterSet.has(s)) inter++;
      const union = matchSet.size + clusterSet.size - inter;
      const sim = union > 0 ? inter / union : 0;
      if (sim >= 0.4) return true;
    }
    return false;
  }

  const candidates = broadMatches.filter(
    (m) =>
      m.missingRequired.length >= 1 &&
      m.missingRequired.length <= 4 &&
      !isCovered(m)
  );

  const sorted = [...candidates].sort((a, b) => {
    const sa = a.coverage * a.matchedRequired.length - 0.15 * a.missingRequired.length;
    const sb = b.coverage * b.matchedRequired.length - 0.15 * b.missingRequired.length;
    if (sb !== sa) return sb - sa;
    return b.score - a.score;
  });

  // Diversity penalty against signature duplication.
  const seen = new Map<string, number>();
  for (const s of sorted) {
    const sig = [...s.matchedRequired].sort().join(",");
    const c = seen.get(sig) ?? 0;
    if (c > 0) s.score *= Math.pow(0.7, c);
    seen.set(sig, c + 1);
  }
  sorted.sort((a, b) => {
    const sa = a.coverage * a.matchedRequired.length - 0.15 * a.missingRequired.length;
    const sb = b.coverage * b.matchedRequired.length - 0.15 * b.missingRequired.length;
    if (sb !== sa) return sb - sa;
    return b.score - a.score;
  });

  return sorted.slice(0, limit);
}
