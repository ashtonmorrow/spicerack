// Recipe matching: find the dishes whose ingredient profile overlaps most
// with the user's current selection. Same shape pattern as the ingredient
// repository so we can swap to a server-side store later without rippling.

import recipesData from "../../data/recipes.json";
import type { Recipe, ScoredRecipe } from "./types";

interface RecipesShape {
  recipes: Recipe[];
}

const recipes: Recipe[] = (recipesData as unknown as RecipesShape).recipes;
const byId = new Map(recipes.map((r) => [r.id, r]));

export function getRecipeById(id: string): Recipe | null {
  return byId.get(id) ?? null;
}

export function listRecipes(): Recipe[] {
  return recipes;
}

// Score = coverage² × matches + 0.15 × matchedOptional
//
// Why coverage²: a recipe whose required list is fully covered by your
// selection should beat a recipe that's only half-covered, even if the
// half-covered one has more absolute matches. Squaring punishes partial
// matches harder than linear coverage would.
//
// We require at least 1 matched required ingredient — recipes you can't
// even start are filtered out.
export function matchRecipes(
  selectedSlugs: string[],
  limit = 4
): ScoredRecipe[] {
  if (selectedSlugs.length === 0) return [];
  const selected = new Set(selectedSlugs);

  const scored: ScoredRecipe[] = [];

  for (const r of recipes) {
    const matchedRequired = r.required.filter((s) => selected.has(s));
    if (matchedRequired.length === 0) continue;
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
    return b.matchedRequired.length - a.matchedRequired.length;
  });

  return scored.slice(0, limit);
}
