"use client";

import { useEffect, useState } from "react";
import type { IngredientSummary, Recipe, ScoredRecipe } from "@/lib/types";
import { isRecipeSaved } from "@/lib/saved-recipes";
import { RecipeModal } from "./RecipeModal";

interface Props {
  selected: IngredientSummary[];
  onUseRecipe: (ingredients: IngredientSummary[]) => void;
  onSavedChanged: () => void;
  savedVersion: number;
}

// Lightweight ingredient lookup — we only need name+category to render chips.
const ingredientCache = new Map<string, IngredientSummary>();

async function fetchIngredient(slug: string): Promise<IngredientSummary | null> {
  if (ingredientCache.has(slug)) return ingredientCache.get(slug)!;
  try {
    const res = await fetch(`/api/ingredients?q=${slug}&limit=1`);
    const data = await res.json();
    const hit = (data.results as IngredientSummary[]).find((r) => r.slug === slug);
    if (hit) ingredientCache.set(slug, hit);
    return hit ?? null;
  } catch {
    return null;
  }
}

export function RecipesPanel({
  selected,
  onUseRecipe,
  onSavedChanged,
  savedVersion,
}: Props) {
  const [matches, setMatches] = useState<ScoredRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [ingredientLookup, setIngredientLookup] = useState<
    Map<string, IngredientSummary>
  >(new Map());
  const [openRecipe, setOpenRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    if (selected.length < 1) {
      setMatches([]);
      return;
    }
    const slugs = selected.map((s) => s.slug).join(",");
    setLoading(true);
    fetch(`/api/recipes?slugs=${encodeURIComponent(slugs)}&limit=4`)
      .then((r) => r.json())
      .then(async (d) => {
        const results = d.results as ScoredRecipe[];
        setMatches(results);

        const referenced = new Set<string>();
        for (const m of results) {
          for (const s of m.recipe.required) referenced.add(s);
          for (const s of m.recipe.optional ?? []) referenced.add(s);
        }
        const lookup = new Map<string, IngredientSummary>();
        for (const s of selected) {
          lookup.set(s.slug, s);
          ingredientCache.set(s.slug, s);
        }
        const toFetch = [...referenced].filter((s) => !lookup.has(s));
        const fetched = await Promise.all(toFetch.map(fetchIngredient));
        for (const ing of fetched) if (ing) lookup.set(ing.slug, ing);
        setIngredientLookup(lookup);
      })
      .finally(() => setLoading(false));
  }, [selected.map((s) => s.slug).join(",")]);

  if (selected.length === 0) return null;

  if (matches.length === 0 && !loading) {
    return (
      <section>
        <h2 className="text-[11px] uppercase tracking-wider text-muted mb-2">
          Recipes you could make
        </h2>
        <div className="rounded-md border border-border bg-bg p-6 text-sm text-muted">
          No matching recipes for this selection yet. Try removing one of the
          ingredients, or save this combination so you can find it later.
        </div>
      </section>
    );
  }

  const userSlugs = new Set(selected.map((s) => s.slug));

  return (
    <>
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] uppercase tracking-wider text-muted">
            Recipes you could make
          </h2>
          {loading && <span className="text-xs text-muted">…</span>}
        </div>
        <div className="space-y-2">
          {matches.map((m) => (
            <RecipeCard
              key={m.recipe.id}
              match={m}
              ingredientLookup={ingredientLookup}
              userSlugs={userSlugs}
              onOpen={() => setOpenRecipe(m.recipe)}
              savedVersion={savedVersion}
            />
          ))}
        </div>
      </section>

      {openRecipe && (
        <RecipeModal
          recipe={openRecipe}
          userIngredientSlugs={userSlugs}
          ingredientLookup={ingredientLookup}
          onClose={() => setOpenRecipe(null)}
          onUseRecipe={onUseRecipe}
          onChanged={onSavedChanged}
        />
      )}
    </>
  );
}

function RecipeCard({
  match,
  ingredientLookup,
  userSlugs,
  onOpen,
  savedVersion,
}: {
  match: ScoredRecipe;
  ingredientLookup: Map<string, IngredientSummary>;
  userSlugs: Set<string>;
  onOpen: () => void;
  savedVersion: number;
}) {
  const r = match.recipe;
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isRecipeSaved(r.id));
  }, [r.id, savedVersion]);

  return (
    <button
      onClick={onOpen}
      className="block w-full text-left border border-border rounded-md p-3.5 hover:bg-hover/50 hover:border-border transition"
    >
      <header className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <h3 className="font-medium text-sm text-ink flex items-center gap-2">
          {r.name}
          {saved && (
            <span className="text-[10px] font-normal text-pear/80 bg-pear/10 px-1.5 py-0.5 rounded">
              ✓ saved
            </span>
          )}
        </h3>
        <span className="text-xs text-muted">
          {match.matchedRequired.length}/{r.required.length} ingredients
          {r.cuisine ? ` · ${r.cuisine}` : ""}
          {r.time ? ` · ${r.time} min` : ""}
        </span>
      </header>
      {r.about && (
        <p className="text-sm text-muted leading-snug mb-2.5">{r.about}</p>
      )}

      <div className="flex flex-wrap gap-1">
        {r.required.map((slug) => {
          const ing = ingredientLookup.get(slug);
          const have = userSlugs.has(slug);
          if (!ing) return null;
          return (
            <span
              key={slug}
              className={`text-xs px-2 py-0.5 rounded inline-flex items-center gap-1 ${
                have
                  ? `cat-${ing.category}`
                  : "bg-hover text-muted line-through decoration-muted/40"
              }`}
            >
              {have ? "✓" : "+"} {ing.name}
            </span>
          );
        })}
      </div>
      <div className="text-xs text-muted/80 mt-2.5">
        Open to view method, save, or use these ingredients →
      </div>
    </button>
  );
}
