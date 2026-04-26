"use client";

import { useEffect, useMemo, useState } from "react";
import type { IngredientSummary, ScoredPairing, Category } from "@/lib/types";

interface Props {
  selected: IngredientSummary[];
  onAdd: (ing: IngredientSummary) => void;
}

const CATEGORIES: Category[] = [
  "herb",
  "spice",
  "vegetable",
  "fruit",
  "protein",
  "dairy",
  "pantry",
  "nut",
  "grain",
  "aromatic",
];

export function PairingsPanel({ selected, onAdd }: Props) {
  const [pairings, setPairings] = useState<ScoredPairing[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Category | "all">("all");

  useEffect(() => {
    if (selected.length === 0) {
      setPairings([]);
      return;
    }
    const slugs = selected.map((s) => s.slug).join(",");
    setLoading(true);
    fetch(`/api/pairings?slugs=${encodeURIComponent(slugs)}&limit=60`)
      .then((r) => r.json())
      .then((d) => setPairings(d.results as ScoredPairing[]))
      .finally(() => setLoading(false));
  }, [selected.map((s) => s.slug).join(",")]);

  const grouped = useMemo(() => {
    const filtered =
      filter === "all"
        ? pairings
        : pairings.filter((p) => p.ingredient.category === filter);
    const map = new Map<Category, ScoredPairing[]>();
    for (const p of filtered) {
      const arr = map.get(p.ingredient.category) ?? [];
      arr.push(p);
      map.set(p.ingredient.category, arr);
    }
    return map;
  }, [pairings, filter]);

  const presentCategories = CATEGORIES.filter(
    (c) => pairings.some((p) => p.ingredient.category === c)
  );

  if (selected.length === 0) {
    return (
      <div className="rounded-md border border-border bg-bg p-10 text-center text-muted">
        <p className="text-base mb-1 text-ink">Suggestions appear here</p>
        <p className="text-sm">Add an ingredient and we&apos;ll show what pairs well.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-bg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">
          Pairs well with{" "}
          <span className="font-normal">
            {selected.map((s) => s.name).join(" + ")}
          </span>
        </h2>
        {loading && <span className="text-xs text-muted">…</span>}
      </div>

      {presentCategories.length > 1 && (
        <div className="flex flex-wrap gap-1 mb-5">
          <FilterChip
            label="all"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          {presentCategories.map((c) => (
            <FilterChip
              key={c}
              label={c}
              active={filter === c}
              onClick={() => setFilter(c)}
            />
          ))}
        </div>
      )}

      {pairings.length === 0 && !loading && (
        <p className="text-muted text-sm">
          No pairings found yet — add some to{" "}
          <code className="bg-hover px-1.5 py-0.5 rounded text-xs">
            data/ingredients.json
          </code>
          .
        </p>
      )}

      <div className="space-y-4">
        {Array.from(grouped.entries()).map(([cat, items]) => (
          <section key={cat}>
            <h3 className="text-[11px] uppercase tracking-wider text-muted mb-1.5">
              {cat}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {items.map((p) => (
                <PairingChip
                  key={p.ingredient.slug}
                  pairing={p}
                  multi={selected.length > 1}
                  onClick={() => onAdd(p.ingredient)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded transition ${
        active ? "bg-ink text-bg" : "bg-hover text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function PairingChip({
  pairing,
  multi,
  onClick,
}: {
  pairing: ScoredPairing;
  multi: boolean;
  onClick: () => void;
}) {
  // dot indicator: more dots = stronger affinity
  const dots = Math.min(3, Math.round(pairing.averageStrength));
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-1.5 px-2.5 py-1 rounded text-sm cat-${pairing.ingredient.category} hover:brightness-95 transition`}
      title={
        multi
          ? `Pairs with ${pairing.hits} of your selections`
          : `Affinity ${pairing.averageStrength.toFixed(1)}/3`
      }
    >
      <span>{pairing.ingredient.name}</span>
      <span className="text-[10px] opacity-60 tracking-tighter">
        {"●".repeat(dots) + "○".repeat(3 - dots)}
      </span>
      {multi && pairing.hits > 1 && (
        <span className="text-[10px] bg-ink/10 px-1.5 py-0.5 rounded font-semibold">
          ×{pairing.hits}
        </span>
      )}
    </button>
  );
}
