"use client";

import { useEffect, useState } from "react";
import type { IngredientSummary } from "@/lib/types";
import { deleteCombo, loadCombos, type SavedCombo } from "@/lib/combos";

interface Props {
  refreshKey: number; // bump to force a reload from storage
  onLoad: (ingredients: IngredientSummary[]) => void;
  onChanged: () => void; // bumped after a delete so peers re-check existence
}

export function SavedCombos({ refreshKey, onLoad, onChanged }: Props) {
  const [combos, setCombos] = useState<SavedCombo[]>([]);

  useEffect(() => {
    setCombos(loadCombos());
  }, [refreshKey]);

  if (combos.length === 0) return null;

  function remove(id: string) {
    deleteCombo(id);
    setCombos(loadCombos());
    onChanged();
  }

  return (
    <section className="mt-10">
      <h2 className="text-[11px] uppercase tracking-wider text-muted mb-2">
        Your saved combos
      </h2>
      <div className="space-y-2">
        {combos.map((c) => (
          <div
            key={c.id}
            className="border border-border rounded-md p-3 hover:bg-hover transition group"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                onClick={() => onLoad(c.ingredients)}
                className="flex-1 text-left"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-ink">{c.name}</span>
                  <span className="text-xs text-muted">
                    {c.ingredients.length} ingredients
                  </span>
                </div>
                {c.about && (
                  <p className="text-sm text-muted mt-1 leading-snug">{c.about}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {c.ingredients.map((i) => (
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
                onClick={() => remove(c.id)}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-ink text-xs transition shrink-0"
                title="Delete combo"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
