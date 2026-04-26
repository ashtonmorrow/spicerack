"use client";

import { useEffect, useState } from "react";
import type { IngredientSummary, ScoredRecipe, Recipe } from "@/lib/types";
import { isRecipeSaved, saveRecipe } from "@/lib/saved-recipes";

interface Props {
  selected: IngredientSummary[];
  onUseRecipe: (ingredients: IngredientSummary[]) => void;
  onSavedChanged: () => void;
  savedVersion: number;
}

// Lightweight ingredient lookup — we only need name+category to render chips,
// and we can fetch them on demand via /api/ingredients. To avoid roundtrips per
// recipe row, we cache by slug.
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
  // slug -> {name, category} for all ingredients referenced by visible recipes
  const [ingredientLookup, setIngredientLookup] = useState<
    Map<string, IngredientSummary>
  >(new Map());

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

        // Resolve every referenced slug for chip rendering.
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

  return (
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
            onUse={() => {
              const all = m.recipe.required.map((s) => ingredientLookup.get(s));
              onUseRecipe(
                all.filter((x): x is IngredientSummary => Boolean(x))
              );
            }}
            onSavedChanged={onSavedChanged}
            savedVersion={savedVersion}
          />
        ))}
      </div>
    </section>
  );
}

function RecipeCard({
  match,
  ingredientLookup,
  onUse,
  onSavedChanged,
  savedVersion,
}: {
  match: ScoredRecipe;
  ingredientLookup: Map<string, IngredientSummary>;
  onUse: () => void;
  onSavedChanged: () => void;
  savedVersion: number;
}) {
  const r = match.recipe;
  const [alreadySaved, setAlreadySaved] = useState(false);

  useEffect(() => {
    setAlreadySaved(isRecipeSaved(r.id));
  }, [r.id, savedVersion]);

  function handleSave() {
    if (alreadySaved) return;
    saveRecipe(r);
    onSavedChanged();
  }

  return (
    <article className="border border-border rounded-md p-3.5 hover:bg-hover/50 transition">
      <header className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <h3 className="font-medium text-sm text-ink">{r.name}</h3>
        <span className="text-xs text-muted">
          {match.matchedRequired.length}/{r.required.length} ingredients
          {r.cuisine ? ` · ${r.cuisine}` : ""}
          {r.time ? ` · ${r.time} min` : ""}
        </span>
      </header>
      {r.about && (
        <p className="text-sm text-muted leading-snug mb-2.5">{r.about}</p>
      )}

      <div className="flex flex-wrap gap-1 mb-3">
        {r.required.map((slug) => {
          const ing = ingredientLookup.get(slug);
          const have = match.matchedRequired.includes(slug);
          if (!ing) return null;
          return (
            <span
              key={slug}
              className={`text-xs px-2 py-0.5 rounded inline-flex items-center gap-1 ${
                have
                  ? `cat-${ing.category}`
                  : "bg-hover text-muted line-through decoration-muted/40"
              }`}
              title={have ? "You have this" : "You'd need to add this"}
            >
              {have ? "✓" : "+"} {ing.name}
            </span>
          );
        })}
        {(r.optional ?? []).map((slug) => {
          const ing = ingredientLookup.get(slug);
          const have = match.matchedOptional.includes(slug);
          if (!ing) return null;
          return (
            <span
              key={slug}
              className={`text-xs px-2 py-0.5 rounded italic ${
                have
                  ? `cat-${ing.category}`
                  : "bg-bg text-muted/60 border border-dashed border-border"
              }`}
              title="Optional"
            >
              {ing.name}
            </span>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onUse}
          className="text-xs px-2.5 py-1 rounded bg-pear text-white hover:brightness-95 transition font-medium"
          title="Replace your selection with this recipe's required ingredients"
        >
          Use this recipe
        </button>
        <button
          onClick={handleSave}
          disabled={alreadySaved}
          className="text-xs px-2.5 py-1 rounded text-ink hover:bg-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {alreadySaved ? "✓ Saved" : "Save recipe"}
        </button>
      </div>
    </article>
  );
}
