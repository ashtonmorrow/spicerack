"use client";

import { useEffect, useState } from "react";
import type { IngredientSummary } from "@/lib/types";

interface Starter {
  id: string;
  name: string;
  note: string;
  slugs: string[];
}

// Hand-curated starting points. Picked to span cuisines and let the app's
// intelligence (clusters, pairings, recipes) reveal itself immediately. Each
// starter is a 4–5 ingredient seed that's a real dish or a known combo, not
// a synthetic test set.
const STARTERS: Starter[] = [
  {
    id: "caprese",
    name: "Caprese",
    note: "Italian summer classic",
    slugs: ["tomato", "basil", "mozzarella", "olive-oil"],
  },
  {
    id: "scandi-salmon",
    name: "Scandi salmon",
    note: "Nordic plate",
    slugs: ["salmon", "dill", "lemon", "butter"],
  },
  {
    id: "thai-shrimp",
    name: "Thai shrimp",
    note: "Lemongrass-lime base",
    slugs: ["shrimp", "lemongrass", "lime", "chili", "garlic"],
  },
  {
    id: "apple-pie",
    name: "Apple pie",
    note: "Sweet pantry pull",
    slugs: ["apple", "cinnamon", "butter", "sugar", "nutmeg"],
  },
  {
    id: "japanese-base",
    name: "Japanese base",
    note: "Umami foundation",
    slugs: ["miso", "ginger", "scallion", "sesame-oil", "soy-sauce"],
  },
  {
    id: "mediterranean-lamb",
    name: "Mediterranean lamb",
    note: "Greek leaning",
    slugs: ["lamb", "yogurt", "mint", "cumin", "lemon"],
  },
  {
    id: "french-chicken",
    name: "French roast chicken",
    note: "Herb butter plate",
    slugs: ["chicken", "thyme", "garlic", "butter", "lemon"],
  },
  {
    id: "cheese-board",
    name: "Cheese board",
    note: "Sweet + savory pairing",
    slugs: ["pear", "blue-cheese", "walnut", "honey", "arugula"],
  },
];

interface Props {
  onLoad: (ingredients: IngredientSummary[]) => void;
}

// Resolves a starter's slugs to IngredientSummary objects via /api/ingredients
// then hands the lot to onLoad. We resolve on click rather than upfront so the
// component doesn't burn 8 × N requests on mount.
async function resolveStarter(slugs: string[]): Promise<IngredientSummary[]> {
  const results = await Promise.all(
    slugs.map(async (slug) => {
      const res = await fetch(`/api/ingredients?q=${slug}&limit=1`);
      const data = await res.json();
      return (data.results as IngredientSummary[]).find((i) => i.slug === slug);
    })
  );
  return results.filter((r): r is IngredientSummary => Boolean(r));
}

export function QuickStart({ onLoad }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [meta, setMeta] = useState<Map<string, IngredientSummary>>(new Map());

  // Resolve all ingredient summaries on mount so we can render colored chips
  // in each card without waiting for click. Cheap — 8 × 5 = 40 lookups, all
  // served from in-memory data on the server.
  useEffect(() => {
    let cancelled = false;
    const all = [...new Set(STARTERS.flatMap((s) => s.slugs))];
    Promise.all(
      all.map(async (slug) => {
        const res = await fetch(`/api/ingredients?q=${slug}&limit=1`);
        const data = await res.json();
        return (data.results as IngredientSummary[]).find((i) => i.slug === slug);
      })
    ).then((items) => {
      if (cancelled) return;
      const m = new Map<string, IngredientSummary>();
      for (const it of items) if (it) m.set(it.slug, it);
      setMeta(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function pick(starter: Starter) {
    setLoading(starter.id);
    try {
      const ings = await resolveStarter(starter.slugs);
      if (ings.length) onLoad(ings);
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="mt-6 mb-10">
      <header className="mb-3">
        <h2 className="text-[11px] uppercase tracking-wider text-muted">
          Or pick a starting point
        </h2>
      </header>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {STARTERS.map((s) => (
          <button
            key={s.id}
            onClick={() => pick(s)}
            disabled={loading !== null}
            className="text-left rounded-md p-3 border border-border hover:bg-hover/60 hover:border-muted/30 transition disabled:opacity-50"
            title={`Load ${s.slugs.length} ingredients — ${s.note}`}
          >
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="font-medium text-sm text-ink truncate">
                {s.name}
              </span>
              <span className="text-[10px] text-muted shrink-0">
                {s.slugs.length}
              </span>
            </div>
            <div className="text-[11px] text-muted mb-2">{s.note}</div>
            <div className="flex flex-wrap gap-1">
              {s.slugs.map((slug) => {
                const ing = meta.get(slug);
                const name = ing?.name ?? slug;
                const cat = ing?.category ?? "pantry";
                return (
                  <span
                    key={slug}
                    className={`text-[11px] px-1.5 py-0.5 rounded cat-${cat}`}
                  >
                    {name}
                  </span>
                );
              })}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
