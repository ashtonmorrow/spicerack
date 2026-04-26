"use client";

import type { IngredientSummary } from "@/lib/types";

interface Props {
  selected: IngredientSummary[];
  onRemove: (slug: string) => void;
  onClear: () => void;
}

// Renders chips inline (no outer wrapper) so it can share a flex row with
// other actions like ComboActions. Returns the empty-state paragraph when
// nothing is selected.
export function SelectedChips({ selected, onRemove, onClear }: Props) {
  if (selected.length === 0) {
    return (
      <p className="text-sm text-muted">
        Pick an ingredient to begin — the more you add, the smarter the suggestions.
      </p>
    );
  }
  return (
    <>
      {selected.map((s) => (
        <button
          key={s.slug}
          onClick={() => onRemove(s.slug)}
          className={`group flex items-center gap-1.5 px-2.5 py-1 rounded text-sm cat-${s.category} hover:brightness-95 transition`}
          title="Remove"
        >
          <span>{s.name}</span>
          <span className="opacity-50 group-hover:opacity-100 text-xs">×</span>
        </button>
      ))}
      {selected.length > 1 && (
        <button
          onClick={onClear}
          className="text-xs text-muted hover:text-ink ml-1 px-2 py-1 rounded hover:bg-hover transition"
        >
          clear all
        </button>
      )}
    </>
  );
}
