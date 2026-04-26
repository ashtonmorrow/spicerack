// localStorage-backed bookmarks of recipes the user wants to keep handy.
// Parallels lib/combos.ts but for built-in (or future user-created) recipes.

import type { Recipe } from "./types";

export interface SavedRecipe {
  id: string;          // local id (different from the recipe's catalog id)
  recipeId: string;    // catalog recipe.id
  recipe: Recipe;      // snapshot — survives even if the catalog evolves
  notes: string;
  createdAt: number;
}

const KEY = "flavor-pear:saved-recipes";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadSavedRecipes(): SavedRecipe[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecipe(recipe: Recipe, notes = ""): SavedRecipe {
  const created: SavedRecipe = {
    id: `sr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    recipeId: recipe.id,
    recipe,
    notes,
    createdAt: Date.now(),
  };
  if (!isBrowser()) return created;
  const all = loadSavedRecipes();
  all.unshift(created);
  window.localStorage.setItem(KEY, JSON.stringify(all));
  return created;
}

export function deleteSavedRecipe(id: string): void {
  if (!isBrowser()) return;
  const remaining = loadSavedRecipes().filter((r) => r.id !== id);
  window.localStorage.setItem(KEY, JSON.stringify(remaining));
}

export function isRecipeSaved(recipeId: string): boolean {
  return loadSavedRecipes().some((r) => r.recipeId === recipeId);
}

// Returns the most recent saved entry for a given catalog recipe id (or null).
export function findSavedByRecipeId(recipeId: string): SavedRecipe | null {
  return loadSavedRecipes().find((r) => r.recipeId === recipeId) ?? null;
}

// Update the user's personal notes on an existing saved recipe.
export function updateRecipeNotes(savedId: string, notes: string): void {
  if (!isBrowser()) return;
  const all = loadSavedRecipes();
  const idx = all.findIndex((r) => r.id === savedId);
  if (idx === -1) return;
  all[idx] = { ...all[idx], notes };
  window.localStorage.setItem(KEY, JSON.stringify(all));
}
