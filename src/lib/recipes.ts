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

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.coverage !== a.coverage) return b.coverage - a.coverage;
    if (b.matchedRequired.length !== a.matchedRequired.length) {
      return b.matchedRequired.length - a.matchedRequired.length;
    }
    // Curated wins ties — prefer our own write-up over an imported one.
    const aCurated = (a.recipe.source ?? "curated") === "curated" ? 1 : 0;
    const bCurated = (b.recipe.source ?? "curated") === "curated" ? 1 : 0;
    return bCurated - aCurated;
  });

  return scored.slice(0, limit);
}
