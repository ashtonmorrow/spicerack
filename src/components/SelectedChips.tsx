"use client";

import type { IngredientSummary } from "@/lib/types";

interface Props {
  selected: IngredientSummary[];
  onRemove: (slug: string) => void;
  onClear: () => void;
  /** Slugs that don't fit any current dish direction. Rendered with a dotted
   *  border + tooltip so the user knows which picks aren't earning their keep. */
  outlierSlugs?: Set<string>;
  /** Slugs that aren't part of the active cluster filter. Rendered dimmed so
   *  the user can see what's outside their current focus. */
  dimmedSlugs?: Set<string>;
}

// Renders chips inline (no outer wrapper) so it can share a flex row with
// other actions like ComboActions. Returns the empty-state paragraph when
// nothing is selected.
export function SelectedChips({
  selected,
  onRemove,
  onClear,
  outlierSlugs,
  dimmedSlugs,
}: Props) {
  if (selected.length === 0) {
    return (
      <p className="text-sm text-muted">
        Pick an ingredient to begin — the more you add, the smarter the suggestions.
      </p>
    );
  }
  return (
    <>
      {selected.map((s) => {
        const isOutlier = outlierSlugs?.has(s.slug);
        const isDimmed = dimmedSlugs?.has(s.slug);
        const base = `group flex items-center gap-1.5 px-2.5 py-1 rounded text-sm transition`;
        const cls = isOutlier
          ? `${base} border border-dashed border-muted/50 bg-bg text-muted hover:bg-hover`
          : `${base} cat-${s.category} hover:brightness-95 ${isDimmed ? "opacity-40" : ""}`;
        const title = isOutlier
          ? "Doesn't fit any current dish direction — try removing or adding more anchor ingredients"
          : "Remove";
        return (
          <button
            key={s.slug}
            onClick={() => onRemove(s.slug)}
            className={cls}
            title={title}
          >
            <span>{s.name}</span>
            <span className="opacity-50 group-hover:opacity-100 text-xs">×</span>
          </button>
        );
      })}
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
