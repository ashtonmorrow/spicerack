// Recipe co-occurrence signal: how often two ingredients appear together in
// the recipe corpus, normalized by Ochiai coefficient. Captures the "dish
// friends" relationship that the curated pairing graph and the Ahn et al.
// compound graph can miss — e.g. chicken + garlic don't share many compounds
// but show up together constantly in real recipes.
//
// Built at dev/CI time by scripts/build-cooccurrence.mjs from the two recipe
// files. The score is co(a,b) / sqrt(freq(a) * freq(b)) ∈ (0, 1].

import data from "../../data/cooccurrence.json";

interface CooccShape {
  byIngredient: Record<string, Record<string, number>>;
}
const c = data as unknown as CooccShape;

/** Recipe co-occurrence score in [0, 1]. Returns 0 if the pair never shares
 *  a recipe (or only shares one, which is filtered out as noise at build
 *  time). */
export function cooccurrenceScore(a: string, b: string): number {
  if (a === b) return 0;
  return c.byIngredient[a]?.[b] ?? 0;
}

export function hasCooccurrenceData(slug: string): boolean {
  return slug in c.byIngredient;
}
