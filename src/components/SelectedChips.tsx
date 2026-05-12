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
  /** slug → CSS color for the cluster the slug belongs to. Renders as a thin
   *  underline so the user can see the partition at chip level. */
  clusterColorBySlug?: Map<string, string>;
  /** slug → label of its cluster — used as part of the chip tooltip. */
  clusterLabelBySlug?: Map<string, string>;
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
  clusterColorBySlug,
  clusterLabelBySlug,
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
        const clusterColor = clusterColorBySlug?.get(s.slug);
        const clusterLabel = clusterLabelBySlug?.get(s.slug);
        const base = `group flex items-center gap-1.5 px-2.5 py-1 rounded text-sm transition`;
        const cls = isOutlier
          ? `${base} border border-dashed border-muted/50 bg-bg text-muted hover:bg-hover`
          : `${base} cat-${s.category} hover:brightness-95 ${isDimmed ? "opacity-40" : ""}`;
        const title = isOutlier
          ? "Doesn't fit any current dish direction — try removing or adding more anchor ingredients"
          : clusterLabel
            ? `In direction: ${clusterLabel} — click to remove`
            : "Remove";
        // Underline keyed to cluster color, via inset shadow so it doesn't
        // disturb the chip's rounded geometry.
        const style =
          clusterColor && !isOutlier
            ? { boxShadow: `inset 0 -2px 0 ${clusterColor}` }
            : undefined;
        return (
          <button
            key={s.slug}
            onClick={() => onRemove(s.slug)}
            className={cls}
            style={style}
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
