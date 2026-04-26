// Recipe matching across two sources:
//   1. data/recipes.json          — hand-curated, has full method + tips
//   2. data/recipes-themealdb.json — community-imported, links out for method
//
// Both are merged on load. When two recipes tie on score, curated wins
// (we trust our own write-up of Caprese over a TheMealDB importer's).

import curatedData from "../../data/recipes.json";
import importedData from "../../data/recipes-themealdb.json";
import type { Recipe, ScoredRecipe } from "./types";

interface RecipesShape {
  recipes: Recipe[];
}

const curated: Recipe[] = (curatedData as unknown as RecipesShape).recipes.map(
  (r) => ({ ...r, source: r.source ?? "curated" })
);
const imported: Recipe[] = (importedData as unknown as RecipesShape).recipes.map(
  (r) => ({ ...r, source: r.source ?? "themealdb" })
);

const recipes: Recipe[] = [...curated, ...imported];
const byId = new Map(recipes.map((r) => [r.id, r]));

export function getRecipeById(id: string): Recipe | null {
  return byId.get(id) ?? null;
}

export function listRecipes(): Recipe[] {
  return recipes;
}

export function recipeCount(): { curated: number; imported: number; total: number } {
  return {
    curated: curated.length,
    imported: imported.length,
    total: recipes.length,
  };
}

// Match-quality threshold scales with selection size. Bigger selections imply
// the user has a real ingredient set in mind and weak matches just add noise.
function minMatched(selectionSize: number): number {
  if (selectionSize >= 6) return 3;
  if (selectionSize >= 3) return 2;
  return 1;
}

// Score = coverage² × matchedRequired + 0.15 × matchedOptional
// Coverage² punishes partial matches (a 50%-covered recipe scores 0.25 per
// matched item, vs 1.0 per matched item at 100% coverage).
//
// Curated source wins ties on the order returned to the API.
export function matchRecipes(
  selectedSlugs: string[],
  limit = 4
): ScoredRecipe[] {
  if (selectedSlugs.length === 0) return [];
  const selected = new Set(selectedSlugs);
  const threshold = minMatched(selectedSlugs.length);

  const scored: ScoredRecipe[] = [];

  for (const r of recipes) {
    const matchedRequired = r.required.filter((s) => selected.has(s));
    if (matchedRequired.length < threshold) continue;
    const missingRequired = r.required.filter((s) => !selected.has(s));
    const matchedOptional = (r.optional ?? []).filter((s) => selected.has(s));

    const coverage = matchedRequired.length / r.required.length;
    const score =
      coverage * coverage * matchedRequired.length + 0.15 * matchedOptional.length;

    scored.push({
      recipe: r,
      score,
      matchedRequired,
      missingRequired,
      matchedOptional,
      coverage,
    });
  }

  scored.sort(compareScored);

  // Diversity pass: penalize recipes whose matched-ingredient signature has
  // already appeared in the ranking. Without this, a 10-ingredient selection
  // can return four nearly-identical beef stews. With it, the top-N becomes
  // a set of distinct "ways to use your ingredients."
  applyDiversityPenalty(scored);
  scored.sort(compareScored);

  return scored.slice(0, limit);
}

function compareScored(a: ScoredRecipe, b: ScoredRecipe): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.coverage !== a.coverage) return b.coverage - a.coverage;
  if (b.matchedRequired.length !== a.matchedRequired.length) {
    return b.matchedRequired.length - a.matchedRequired.length;
  }
  // Curated wins ties — prefer our own write-up over an imported one.
  const aCurated = (a.recipe.source ?? "curated") === "curated" ? 1 : 0;
  const bCurated = (b.recipe.source ?? "curated") === "curated" ? 1 : 0;
  return bCurated - aCurated;
}

function signatureOf(s: ScoredRecipe): string {
  return [...s.matchedRequired].sort().join(",");
}

// 30% penalty per duplicate of a previously-seen matched-ingredient signature.
// Compounds: a 3rd recipe with the same signature gets 30%×30% = 49% off.
// Tuned empirically against the 10-ingredient case so distinct dish vectors
// surface, but a 3-ingredient case (where every match has the same signature)
// doesn't over-penalize.
function applyDiversityPenalty(scored: ScoredRecipe[]): void {
  const seen = new Map<string, number>();
  for (const s of scored) {
    const sig = signatureOf(s);
    const seenCount = seen.get(sig) ?? 0;
    if (seenCount > 0) {
      s.score *= Math.pow(0.7, seenCount);
    }
    seen.set(sig, seenCount + 1);
  }
}

// ----- cuisine inference -----

export interface CuisineSignal {
  /** dominant cuisine name, lowercase, or null when no clear signal */
  cuisine: string | null;
  /** weighted share of the top cuisine, 0..1 */
  share: number;
  /** ranked breakdown of all cuisines that appeared */
  breakdown: Array<{ cuisine: string; share: number }>;
}

/**
 * Infer the dominant cuisine of an ingredient selection by weighting each
 * matched recipe by its score and summing per cuisine. Returns:
 *   - share >= 0.45 → "mostly"
 *   - 0.25 <= share < 0.45 → "leans"
 *   - else null cuisine (no signal strong enough to surface)
 */
export function inferCuisine(matches: ScoredRecipe[]): CuisineSignal {
  if (matches.length === 0) {
    return { cuisine: null, share: 0, breakdown: [] };
  }
  const totals = new Map<string, number>();
  let total = 0;
  for (const m of matches) {
    if (!m.recipe.cuisine || m.score <= 0) continue;
    totals.set(m.recipe.cuisine, (totals.get(m.recipe.cuisine) ?? 0) + m.score);
    total += m.score;
  }
  if (total === 0) return { cuisine: null, share: 0, breakdown: [] };

  const breakdown = [...totals.entries()]
    .map(([cuisine, weight]) => ({ cuisine, share: weight / total }))
    .sort((a, b) => b.share - a.share);

  const top = breakdown[0];
  // Below 0.25 there's no signal worth surfacing — too even a spread.
  if (!top || top.share < 0.25) {
    return { cuisine: null, share: top?.share ?? 0, breakdown };
  }
  return { cuisine: top.cuisine, share: top.share, breakdown };
}
