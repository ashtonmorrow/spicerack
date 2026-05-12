"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { IngredientSummary, ScoredRecipe } from "@/lib/types";

interface Props {
  alternates: ScoredRecipe[];
  /** Selected-ingredient summaries (for matched chips that are already in selection). */
  selected: IngredientSummary[];
  /** Called when the user clicks an "Add X" chip on a missing ingredient. */
  onAdd: (ing: IngredientSummary) => void;
}

// Cache resolved IngredientSummary lookups across renders / cards.
const ingredientCache = new Map<string, IngredientSummary>();

async function resolveIngredient(slug: string): Promise<IngredientSummary | null> {
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

// Surfaces recipes the user is *partway to* but isn't already on track for —
// e.g. shrimp + chili + onion + garlic in a chicken-leaning selection are also
// the start of several Thai recipes. Each card shows what's already there
// alongside one-click add-buttons for what's missing.
export function AlternateDirections({
  alternates,
  selected,
  onAdd,
}: Props) {
  const [lookup, setLookup] = useState<Map<string, IngredientSummary>>(
    () => new Map(selected.map((s) => [s.slug, s]))
  );

  // Resolve every slug referenced by every alternate (matched + missing) so
  // chip rendering has a name + category for each. Selected ingredients are
  // already in the lookup; everything else is fetched lazily.
  useEffect(() => {
    const referenced = new Set<string>();
    for (const m of alternates) {
      for (const s of m.matchedRequired) referenced.add(s);
      for (const s of m.missingRequired) referenced.add(s);
    }
    const seeded = new Map<string, IngredientSummary>(
      selected.map((s) => [s.slug, s])
    );
    const toFetch: string[] = [];
    for (const s of referenced) {
      if (!seeded.has(s)) toFetch.push(s);
    }
    if (toFetch.length === 0) {
      setLookup(seeded);
      return;
    }
    let cancelled = false;
    Promise.all(toFetch.map(resolveIngredient)).then((fetched) => {
      if (cancelled) return;
      const merged = new Map(seeded);
      for (const ing of fetched) {
        if (ing) merged.set(ing.slug, ing);
      }
      setLookup(merged);
    });
    return () => {
      cancelled = true;
    };
  }, [alternates, selected]);

  if (alternates.length === 0) return null;

  return (
    <section className="mb-6">
      <header className="flex items-baseline gap-2 mb-2 flex-wrap">
        <h2 className="text-[11px] uppercase tracking-wider text-muted">
          Alternate directions
        </h2>
        <span className="text-[11px] text-muted/80 normal-case tracking-normal">
          recipes you&apos;re partway to — add what&apos;s missing to get there
        </span>
      </header>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2">
        {alternates.map((m) => (
          <AlternateCard
            key={m.recipe.id}
            match={m}
            ingredientLookup={lookup}
            onAdd={onAdd}
          />
        ))}
      </div>
    </section>
  );
}

function AlternateCard({
  match,
  ingredientLookup,
  onAdd,
}: {
  match: ScoredRecipe;
  ingredientLookup: Map<string, IngredientSummary>;
  onAdd: (ing: IngredientSummary) => void;
}) {
  const r = match.recipe;
  const meta = [
    r.cuisine,
    r.course,
    r.time ? `${r.time} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="border border-border rounded-md p-3 hover:bg-hover/40 transition">
      <header className="flex items-baseline justify-between gap-2 mb-1.5 flex-wrap">
        <Link
          href={`/recipes/${r.id}`}
          className="font-medium text-sm text-ink hover:text-pear transition"
        >
          {r.name}
        </Link>
        <span className="text-[11px] text-muted shrink-0">
          {match.matchedRequired.length}/{r.required.length}
          {meta ? ` · ${meta}` : ""}
        </span>
      </header>

      <div className="flex flex-wrap gap-1 mb-2">
        {match.matchedRequired.map((slug) => {
          const ing = ingredientLookup.get(slug);
          if (!ing) return null;
          return (
            <span
              key={slug}
              className={`text-[11px] px-1.5 py-0.5 rounded cat-${ing.category}`}
            >
              ✓ {ing.name}
            </span>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted/70 mr-1">
          add to complete:
        </span>
        {match.missingRequired.map((slug) => {
          const ing = ingredientLookup.get(slug);
          if (!ing) return null;
          return (
            <button
              key={slug}
              onClick={() => onAdd(ing)}
              className={`text-[11px] px-1.5 py-0.5 rounded cat-${ing.category} hover:brightness-95 transition`}
              title={`Add ${ing.name} — completes a step toward ${r.name}`}
            >
              + {ing.name}
            </button>
          );
        })}
      </div>
    </article>
  );
}
