"use client";

import { useEffect, useState } from "react";
import type { IngredientSummary } from "@/lib/types";
import {
  deleteSavedRecipe,
  loadSavedRecipes,
  type SavedRecipe,
} from "@/lib/saved-recipes";

interface Props {
  refreshKey: number;
  onLoad: (ingredients: IngredientSummary[]) => void;
  onChanged: () => void;
}

// Cache for resolving slugs to {name, category} on render. Filled lazily.
const ingredientCache = new Map<string, IngredientSummary>();

async function resolveIngredients(slugs: string[]): Promise<IngredientSummary[]> {
  const out: IngredientSummary[] = [];
  const missing: string[] = [];
  for (const s of slugs) {
    if (ingredientCache.has(s)) out.push(ingredientCache.get(s)!);
    else missing.push(s);
  }
  if (missing.length) {
    const fetched = await Promise.all(
      missing.map(async (s) => {
        const res = await fetch(`/api/ingredients?q=${s}&limit=1`);
        const data = await res.json();
        return (data.results as IngredientSummary[]).find((r) => r.slug === s);
      })
    );
    for (const ing of fetched) {
      if (ing) {
        ingredientCache.set(ing.slug, ing);
        out.push(ing);
      }
    }
  }
  return out;
}

export function SavedRecipes({ refreshKey, onLoad, onChanged }: Props) {
  const [saved, setSaved] = useState<SavedRecipe[]>([]);
  const [chips, setChips] = useState<Map<string, IngredientSummary[]>>(new Map());

  useEffect(() => {
    const list = loadSavedRecipes();
    setSaved(list);
    // Resolve chip data for every saved recipe.
    Promise.all(
      list.map(async (sr) => {
        const ing = await resolveIngredients(sr.recipe.required);
        return [sr.id, ing] as const;
      })
    ).then((entries) => setChips(new Map(entries)));
  }, [refreshKey]);

  if (saved.length === 0) return null;

  function remove(id: string) {
    deleteSavedRecipe(id);
    setSaved(loadSavedRecipes());
    onChanged();
  }

  return (
    <section className="mt-10">
      <h2 className="text-[11px] uppercase tracking-wider text-muted mb-2">
        Your saved recipes
      </h2>
      <div className="space-y-2">
        {saved.map((sr) => {
          const ingredients = chips.get(sr.id) ?? [];
          return (
            <div
              key={sr.id}
              className="border border-border rounded-md p-3 hover:bg-hover transition group"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => onLoad(ingredients)}
                  className="flex-1 text-left"
                  disabled={ingredients.length === 0}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-ink">
                      {sr.recipe.name}
                    </span>
                    {sr.recipe.cuisine && (
                      <span className="text-xs text-muted">
                        {sr.recipe.cuisine}
                      </span>
                    )}
                  </div>
                  {sr.recipe.about && (
                    <p className="text-sm text-muted mt-1 leading-snug">
                      {sr.recipe.about}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {ingredients.map((i) => (
                      <span
                        key={i.slug}
                        className={`text-[10px] px-1.5 py-0.5 rounded cat-${i.category}`}
                      >
                        {i.name}
                      </span>
                    ))}
                  </div>
                </button>
                <button
                  onClick={() => remove(sr.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted hover:text-ink text-xs transition shrink-0"
                  title="Delete saved recipe"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
