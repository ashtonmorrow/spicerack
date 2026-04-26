"use client";

import { useEffect, useState } from "react";
import type { IngredientSummary, Recipe } from "@/lib/types";
import { loadSavedRecipes, type SavedRecipe } from "@/lib/saved-recipes";
import { RecipeModal } from "./RecipeModal";

interface Props {
  refreshKey: number;
  onLoad: (ingredients: IngredientSummary[]) => void;
  onChanged: () => void;
}

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
  // chips per saved recipe id
  const [chips, setChips] = useState<Map<string, IngredientSummary[]>>(new Map());
  // shared lookup across all saved recipes for the modal
  const [lookup, setLookup] = useState<Map<string, IngredientSummary>>(new Map());
  const [openRecipe, setOpenRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    const list = loadSavedRecipes();
    setSaved(list);
    Promise.all(
      list.map(async (sr) => {
        const all = [
          ...sr.recipe.required,
          ...(sr.recipe.optional ?? []),
        ];
        const ing = await resolveIngredients(all);
        return { id: sr.id, required: sr.recipe.required, ing };
      })
    ).then((entries) => {
      const c = new Map<string, IngredientSummary[]>();
      const l = new Map<string, IngredientSummary>();
      for (const e of entries) {
        const requiredSet = new Set(e.required);
        c.set(
          e.id,
          e.ing.filter((i) => requiredSet.has(i.slug))
        );
        for (const i of e.ing) l.set(i.slug, i);
      }
      setChips(c);
      setLookup(l);
    });
  }, [refreshKey]);

  if (saved.length === 0) return null;

  return (
    <>
      <section>
        <h2 className="text-[11px] uppercase tracking-wider text-muted mb-2">
          Your saved recipes
        </h2>
        <div className="space-y-2">
          {saved.map((sr) => {
            const ingredients = chips.get(sr.id) ?? [];
            return (
              <button
                key={sr.id}
                onClick={() => setOpenRecipe(sr.recipe)}
                className="block w-full text-left border border-border rounded-md p-3 hover:bg-hover transition"
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
                {sr.notes && (
                  <p className="text-xs text-ink/80 mt-1.5 italic leading-snug">
                    “{sr.notes}”
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
            );
          })}
        </div>
      </section>

      {openRecipe && (
        <RecipeModal
          recipe={openRecipe}
          userIngredientSlugs={new Set()}
          ingredientLookup={lookup}
          onClose={() => setOpenRecipe(null)}
          onUseRecipe={onLoad}
          onChanged={onChanged}
        />
      )}
    </>
  );
}
