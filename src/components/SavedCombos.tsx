"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { IngredientSummary } from "@/lib/types";
import {
  deleteCombo,
  loadCombosSorted,
  togglePinnedCombo,
  type SavedCombo,
} from "@/lib/combos";
import { PinIcon } from "./PinIcon";

interface Props {
  refreshKey: number; // bump to force a reload from storage
  onLoad: (ingredients: IngredientSummary[]) => void;
  onChanged: () => void; // bumped after a delete so peers re-check existence
}

export function SavedCombos({ refreshKey, onLoad, onChanged }: Props) {
  const [combos, setCombos] = useState<SavedCombo[]>([]);

  useEffect(() => {
    setCombos(loadCombosSorted());
  }, [refreshKey]);

  if (combos.length === 0) return null;

  function remove(id: string) {
    deleteCombo(id);
    setCombos(loadCombosSorted());
    onChanged();
  }

  function togglePin(id: string) {
    togglePinnedCombo(id);
    setCombos(loadCombosSorted());
    onChanged();
  }

  return (
    <section>
      <h2 className="text-[11px] uppercase tracking-wider text-muted mb-2">
        Your saved combos
      </h2>
      <div className="space-y-2">
        {combos.map((c) => (
          <div
            key={c.id}
            className="relative border border-border rounded-md hover:bg-hover transition group"
          >
            <button
              onClick={() => onLoad(c.ingredients)}
              className="block w-full text-left p-3 pr-9"
            >
              <div className="flex items-center gap-2 flex-wrap">
                {c.pinned && (
                  <PinIcon filled size={12} className="text-pear shrink-0" />
                )}
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
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <Link
                href={`/combos/${c.id}`}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-ink text-[11px] transition px-1.5 py-0.5 rounded"
                title="Open combo page"
                onClick={(e) => e.stopPropagation()}
              >
                Page ↗
              </Link>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(c.id);
                }}
                className={`w-7 h-7 rounded flex items-center justify-center transition ${
                  c.pinned
                    ? "text-pear opacity-100"
                    : "text-muted opacity-0 group-hover:opacity-100 hover:text-ink hover:bg-bg"
                }`}
                title={c.pinned ? "Unpin" : "Pin to top"}
                aria-label={c.pinned ? "Unpin combo" : "Pin combo"}
              >
                <PinIcon filled={Boolean(c.pinned)} />
              </button>
              <button
                onClick={() => remove(c.id)}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-ink text-xs transition px-1.5 py-0.5 rounded"
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
