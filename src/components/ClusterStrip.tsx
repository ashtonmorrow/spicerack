"use client";

import { useEffect, useState } from "react";
import type { AnchorSuggestion, IngredientSummary } from "@/lib/types";
import type { RecipeCluster, SelectionAnalysis } from "@/lib/clusters";
import { shouldShowClusters } from "@/lib/clusters";

interface Props {
  analysis: SelectionAnalysis;
  /** Looks up name + category for an ingredient slug for chip rendering. */
  ingredientLookup: Map<string, IngredientSummary>;
  /** Currently active cluster id — null means "show all". */
  activeClusterId: string | null;
  onSelectCluster: (id: string | null) => void;
  /** Slugs of the user's current selection — used to filter anchor suggestions
   *  so we don't propose ingredients they already have. */
  selectedSlugs: string[];
  /** Called when the user clicks an anchor suggestion. */
  onAdd: (ing: IngredientSummary) => void;
}

export function ClusterStrip({
  analysis,
  ingredientLookup,
  activeClusterId,
  onSelectCluster,
  selectedSlugs,
  onAdd,
}: Props) {
  // Bridge-aware anchor suggestions per outlier slug, fetched in one
  // round-trip via /api/anchors. The endpoint scores each candidate by
  // (its strength to the outlier) + (its bridge strength to the rest of
  // the selection), so anchors that *also* connect to multiple existing
  // ingredients win — those are the ones that fold the outlier into a
  // real direction.
  const [anchors, setAnchors] = useState<Map<string, AnchorSuggestion[]>>(
    new Map()
  );

  useEffect(() => {
    if (analysis.outliers.length === 0) {
      setAnchors(new Map());
      return;
    }
    let cancelled = false;
    const url =
      `/api/anchors?outliers=${encodeURIComponent(analysis.outliers.join(","))}` +
      `&selection=${encodeURIComponent(selectedSlugs.join(","))}` +
      `&limit=3`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const m = new Map<string, AnchorSuggestion[]>();
        for (const [slug, list] of Object.entries(
          (data.results ?? {}) as Record<string, AnchorSuggestion[]>
        )) {
          m.set(slug, list);
        }
        setAnchors(m);
      })
      .catch(() => {
        if (!cancelled) setAnchors(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [analysis.outliers.join(","), selectedSlugs.join(",")]);

  if (!shouldShowClusters(analysis)) return null;

  const { clusters, outliers } = analysis;
  return (
    <section className="mb-6">
      <header className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-[11px] uppercase tracking-wider text-muted">
          Your selection has {clusters.length} direction
          {clusters.length === 1 ? "" : "s"}
        </h2>
        {activeClusterId && (
          <button
            onClick={() => onSelectCluster(null)}
            className="text-[11px] text-muted hover:text-ink hover:bg-hover transition px-2 py-1 rounded"
          >
            Show all
          </button>
        )}
      </header>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {clusters.map((c) => (
          <ClusterCard
            key={c.id}
            cluster={c}
            ingredientLookup={ingredientLookup}
            active={activeClusterId === c.id}
            onClick={() =>
              onSelectCluster(activeClusterId === c.id ? null : c.id)
            }
          />
        ))}
      </div>

      {outliers.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-muted">
            Outliers
            <span
              className="ml-2 normal-case tracking-normal text-muted/80 text-[11px]"
              title="These don't fit any current direction. Add a partner to anchor them, or remove."
            >
              don&apos;t fit any direction yet
            </span>
          </p>
          {outliers.map((slug) => {
            const ing = ingredientLookup.get(slug);
            const name = ing?.name ?? slug;
            const cands = anchors.get(slug) ?? [];
            return (
              <div
                key={slug}
                className="flex flex-wrap items-center gap-1.5 text-xs"
              >
                <span className="px-2 py-0.5 rounded border border-dashed border-muted/40 text-muted bg-bg">
                  {name}
                </span>
                {cands.length > 0 && (
                  <>
                    <span className="text-muted">→ pair with</span>
                    {cands.map((c) => {
                      const isBridge = c.bridgeStrength > 0;
                      return (
                        <button
                          key={c.ingredient.slug}
                          onClick={() => onAdd(c.ingredient)}
                          className={`px-2 py-0.5 rounded cat-${c.ingredient.category} hover:brightness-95 transition`}
                          title={
                            isBridge
                              ? `Adds ${c.ingredient.name} — also pairs with ${c.bridgeStrength} unit${c.bridgeStrength === 1 ? "" : "s"} of strength to your other ingredients (a real bridge)`
                              : `Adds ${c.ingredient.name} to anchor ${name}`
                          }
                        >
                          + {c.ingredient.name}
                          {isBridge && (
                            <span
                              className="ml-1 text-[9px] opacity-60"
                              aria-label="bridge"
                            >
                              ⇌
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </>
                )}
                {cands.length === 0 && (
                  <span className="text-muted/70">
                    (no anchor suggestions found)
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ClusterCard({
  cluster,
  ingredientLookup,
  active,
  onClick,
}: {
  cluster: RecipeCluster;
  ingredientLookup: Map<string, IngredientSummary>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-md p-3 transition w-full ${
        active
          ? "border-2 border-pear bg-pear/5"
          : "border border-border hover:bg-hover/60 hover:border-muted/30"
      }`}
      title={
        active
          ? "Click again to clear filter"
          : `Filter recipes and pairings to this direction`
      }
    >
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="font-medium text-sm text-ink truncate">
          {cluster.label}
        </span>
        <span className="text-[10px] text-muted shrink-0">
          {cluster.ingredients.length} ingredient
          {cluster.ingredients.length === 1 ? "" : "s"}
          {cluster.recipes.length > 1 && ` · ${cluster.recipes.length} recipes`}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {cluster.ingredients.map((slug) => {
          const ing = ingredientLookup.get(slug);
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
  );
}
