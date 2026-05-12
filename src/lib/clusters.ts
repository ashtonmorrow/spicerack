// Detects "dish directions" inside the user's selection by clustering the
// recipe matches.
//
// The intuition: every matched recipe carries a `matchedRequired` set — the
// subset of the user's ingredients it actually uses. Two recipes that share
// most of their matched set are pulling on the same dish vector. Group those,
// and each group's union of matched ingredients becomes one "direction" the
// user could lean into.
//
// Connector ingredients (apple, butter, garlic, etc.) naturally appear in
// multiple clusters because they're in multiple recipes' matched sets — no
// special-casing required. Outliers (selected ingredients not in any match)
// fall out for free.

import type { ScoredRecipe } from "./types";

export interface RecipeCluster {
  id: string;
  /** Slugs of the user's selected ingredients that anchor this direction. */
  ingredients: string[];
  /** Recipes participating in this cluster, top-scoring first. */
  recipes: ScoredRecipe[];
  /** A short human label, derived from the cluster's top recipe. */
  label: string;
  /** The combined score of the cluster's recipes — used for sort order. */
  totalScore: number;
}

export interface SelectionAnalysis {
  clusters: RecipeCluster[];
  /** Selected slugs that don't appear in any matched recipe's matchedRequired. */
  outliers: string[];
}

/** Jaccard similarity of two sets of slugs. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const s of a) if (b.has(s)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function unionOf(recipes: ScoredRecipe[]): Set<string> {
  const out = new Set<string>();
  for (const r of recipes) for (const s of r.matchedRequired) out.add(s);
  return out;
}

/**
 * Greedy agglomerative clustering. Start with each recipe as its own cluster;
 * repeatedly merge the most-similar pair whose Jaccard ≥ threshold; stop when
 * no candidate pair clears the bar.
 *
 * Threshold tuned empirically: 0.4 keeps "Beef Stew" and "Coq au Vin" in
 * separate clusters (they only share onion+thyme of their matched sets) but
 * groups "Apple Pie Filling" and "Caramel Apples" together (both apple-led).
 */
function cluster(matches: ScoredRecipe[], threshold = 0.4): ScoredRecipe[][] {
  if (matches.length === 0) return [];
  let clusters: ScoredRecipe[][] = matches.map((m) => [m]);

  // Cap iterations defensively.
  for (let pass = 0; pass < 100; pass++) {
    let bestI = -1;
    let bestJ = -1;
    let bestSim = threshold;
    const setCache = clusters.map(unionOf);
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const sim = jaccard(setCache[i], setCache[j]);
        if (sim > bestSim) {
          bestSim = sim;
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (bestI === -1) break;
    clusters[bestI] = [...clusters[bestI], ...clusters[bestJ]];
    clusters.splice(bestJ, 1);
  }
  return clusters;
}

function makeId(slugs: string[]): string {
  return [...slugs].sort().join("+");
}

export function analyzeSelection(
  selectedSlugs: string[],
  matches: ScoredRecipe[]
): SelectionAnalysis {
  // Outliers: selected slugs that no matched recipe actually uses.
  const usedByAnyRecipe = new Set<string>();
  for (const m of matches) for (const s of m.matchedRequired) usedByAnyRecipe.add(s);
  const outliers = selectedSlugs.filter((s) => !usedByAnyRecipe.has(s));

  if (matches.length === 0) {
    return { clusters: [], outliers };
  }

  const groups = cluster(matches);

  // Build cluster objects, sorted by total score so the strongest direction
  // appears first.
  const out: RecipeCluster[] = groups
    .map((g) => {
      const ings = [...unionOf(g)].sort();
      const sortedRecipes = [...g].sort((a, b) => b.score - a.score);
      const top = sortedRecipes[0];
      return {
        id: makeId(ings),
        ingredients: ings,
        recipes: sortedRecipes,
        // Label = top recipe's name, truncated. Compact but always recognizable.
        label: top.recipe.name,
        totalScore: g.reduce((sum, r) => sum + r.score, 0),
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  return { clusters: out, outliers };
}

/**
 * Useful for the UI: only show the cluster strip when there's actual signal —
 * at least 2 distinct directions, OR a single direction with outliers. A lone
 * cluster with no outliers means the selection is coherent and the strip adds
 * noise.
 */
export function shouldShowClusters(analysis: SelectionAnalysis): boolean {
  if (analysis.clusters.length >= 2) return true;
  if (analysis.clusters.length >= 1 && analysis.outliers.length > 0) return true;
  return false;
}

/**
 * "Alternate directions" — recipes the user is partway to that aren't already
 * represented by the main clusters. Surfaces, for example, Thai recipes when
 * shrimp + chili + onion are present in a chicken-leaning selection.
 *
 * Inputs:
 *   - broadMatches: recipes matched with a *relaxed* threshold (hits >= 2),
 *     not the strict default.
 *   - clusters: the existing clusters (from analyzeSelection of the strict set).
 *
 * Filters:
 *   - matched-ingredient signature isn't a subset of any existing cluster's
 *     ingredient set (otherwise it's already represented)
 *   - missing.length is between 1 and 4 (achievable to complete; >4 is too far)
 *   - apply diversity penalty so we don't show 4 near-identical alternates
 */
export function findAlternates(
  broadMatches: ScoredRecipe[],
  clusters: RecipeCluster[],
  limit = 4
): ScoredRecipe[] {
  if (broadMatches.length === 0) return [];

  const clusterSets = clusters.map((c) => new Set(c.ingredients));

  function isCovered(match: ScoredRecipe): boolean {
    // A match is "covered" by a cluster iff its matched signature would merge
    // INTO that cluster under the same Jaccard threshold the clusterer uses
    // (0.4). Using subset-containment instead is too aggressive — the cluster
    // union absorbs most slugs, hiding legitimate alternate dish vectors.
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

  // Sort by completability: weight matched count by coverage, penalize
  // missing count slightly so easier-to-complete recipes float up.
  const sorted = [...candidates].sort((a, b) => {
    const sa = a.coverage * a.matchedRequired.length - 0.15 * a.missingRequired.length;
    const sb = b.coverage * b.matchedRequired.length - 0.15 * b.missingRequired.length;
    if (sb !== sa) return sb - sa;
    return b.score - a.score;
  });

  // Diversity penalty against signature duplication, same as primary matches.
  const seen = new Map<string, number>();
  for (const s of sorted) {
    const sig = [...s.matchedRequired].sort().join(",");
    const c = seen.get(sig) ?? 0;
    if (c > 0) s.score *= Math.pow(0.7, c);
    seen.set(sig, c + 1);
  }
  // One more sort pass after the penalty.
  sorted.sort((a, b) => {
    const sa = a.coverage * a.matchedRequired.length - 0.15 * a.missingRequired.length;
    const sb = b.coverage * b.matchedRequired.length - 0.15 * b.missingRequired.length;
    if (sb !== sa) return sb - sa;
    return b.score - a.score;
  });

  return sorted.slice(0, limit);
}
