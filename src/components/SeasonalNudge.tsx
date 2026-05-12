"use client";

import { useEffect, useState } from "react";
import type { IngredientSummary } from "@/lib/types";

interface Props {
  /** Called when the user clicks an in-season chip — adds that single
   *  ingredient to the selection so the discovery flow can take over. */
  onAdd: (ing: IngredientSummary) => void;
}

const SEASON_COPY: Record<string, { label: string; glyph: string }> = {
  spring: { label: "In season this spring", glyph: "🌱" },
  summer: { label: "In season this summer", glyph: "☀️" },
  fall: { label: "In season this fall", glyph: "🍂" },
  winter: { label: "In season this winter", glyph: "❄️" },
};

export function SeasonalNudge({ onAdd }: Props) {
  const [season, setSeason] = useState<string | null>(null);
  const [items, setItems] = useState<IngredientSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/seasonal?limit=10")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSeason(data.season);
        setItems(data.results as IngredientSummary[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0 || !season) return null;
  const copy = SEASON_COPY[season] ?? { label: "In season now", glyph: "🌱" };

  return (
    <section className="mt-6 mb-2">
      <header className="flex items-baseline gap-2 mb-2">
        <h2 className="text-[11px] uppercase tracking-wider text-muted">
          <span className="mr-1" aria-hidden>{copy.glyph}</span>
          {copy.label}
        </h2>
        <span className="text-[11px] text-muted/80 normal-case tracking-normal">
          click to start with one
        </span>
      </header>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <button
            key={i.slug}
            onClick={() => onAdd(i)}
            className={`text-xs px-2 py-0.5 rounded cat-${i.category} hover:brightness-95 transition`}
            title={`Add ${i.name} — peaks ${season}`}
          >
            {i.name}
          </button>
        ))}
      </div>
    </section>
  );
}
