// Flavor chemistry signal: ingredients with many shared volatile compounds
// tend to taste good together (Ahn et al. 2011's "food pairing" hypothesis,
// validated for Western cuisines).
//
// Loaded from data/compound-data.json which is a slimmed-down subset of the
// Ahn et al. dataset to just the ingredients we already know about.

import compoundData from "../../data/compound-data.json";

interface CompoundShape {
  compounds: Record<string, string>;
  byIngredient: Record<string, number[]>;
}

const data = compoundData as unknown as CompoundShape;

// Build Set<number>'s lazily for fast intersection lookups.
const setCache = new Map<string, Set<number>>();
function setFor(slug: string): Set<number> | null {
  const arr = data.byIngredient[slug];
  if (!arr) return null;
  let s = setCache.get(slug);
  if (!s) {
    s = new Set(arr);
    setCache.set(slug, s);
  }
  return s;
}

export function hasCompoundProfile(slug: string): boolean {
  return slug in data.byIngredient;
}

/** Number of flavor compounds shared by both ingredients. */
export function sharedCompounds(slugA: string, slugB: string): number {
  const a = setFor(slugA);
  const b = setFor(slugB);
  if (!a || !b) return 0;
  let count = 0;
  // Iterate the smaller set for efficiency.
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const c of smaller) if (larger.has(c)) count++;
  return count;
}

/** Jaccard-style normalized similarity (0..1). Useful for ranking. */
export function compoundSimilarity(slugA: string, slugB: string): number {
  const a = setFor(slugA);
  const b = setFor(slugB);
  if (!a || !b) return 0;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const c of a) if (b.has(c)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

export interface ChemistryPairing {
  slug: string;
  meanShared: number;   // average shared-compound count vs the selection
  meanSimilarity: number; // Jaccard-style, normalized
}

/**
 * For a given ingredient selection, find ingredients (not already in the
 * selection, restricted to the provided candidates) that share the most
 * flavor compounds on average. Returns top N by `meanShared`.
 */
export function chemistryPairingsFor(
  selectedSlugs: string[],
  candidateSlugs: string[],
  limit = 8
): ChemistryPairing[] {
  if (selectedSlugs.length === 0) return [];
  const selected = selectedSlugs.filter((s) => hasCompoundProfile(s));
  if (selected.length === 0) return [];
  const selectedSet = new Set(selectedSlugs);

  const out: ChemistryPairing[] = [];
  for (const cand of candidateSlugs) {
    if (selectedSet.has(cand)) continue;
    if (!hasCompoundProfile(cand)) continue;
    let sumShared = 0;
    let sumSim = 0;
    for (const sel of selected) {
      sumShared += sharedCompounds(cand, sel);
      sumSim += compoundSimilarity(cand, sel);
    }
    const meanShared = sumShared / selected.length;
    const meanSimilarity = sumSim / selected.length;
    if (meanShared <= 0) continue;
    out.push({ slug: cand, meanShared, meanSimilarity });
  }
  out.sort(
    (a, b) =>
      b.meanShared - a.meanShared ||
      b.meanSimilarity - a.meanSimilarity ||
      a.slug.localeCompare(b.slug)
  );
  return out.slice(0, limit);
}
