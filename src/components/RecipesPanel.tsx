"use client";

import { useEffect, useState } from "react";
import type { IngredientSummary, Recipe, ScoredRecipe } from "@/lib/types";
import { isRecipeSaved } from "@/lib/saved-recipes";
import { RecipeModal } from "./RecipeModal";

interface Props {
  selected: IngredientSummary[];
  onUseRecipe: (ingredients: IngredientSummary[]) => void;
  onSavedChanged: () => void;
  savedVersion: number;
}

// Lightweight ingredient lookup — we only need name+category to render chips.
const ingredientCache = new Map<string, IngredientSummary>();

async function fetchIngredient(slug: string): Promise<IngredientSummary | null> {
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

const DEFAULT_VISIBLE = 4;

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function RecipesPanel({
  selected,
  onUseRecipe,
  onSavedChanged,
  savedVersion,
}: Props) {
  const [matches, setMatches] = useState<ScoredRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [ingredientLookup, setIngredientLookup] = useState<
    Map<string, IngredientSummary>
  >(new Map());
  const [openRecipe, setOpenRecipe] = useState<Recipe | null>(null);

  // Filter state
  const [cuisineFilter, setCuisineFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [pantryMode, setPantryMode] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selected.length < 1) {
      setMatches([]);
      return;
    }
    // Reset filters when the selection changes — context shifts, prior filters
    // become stale.
    setCuisineFilter("all");
    setCourseFilter("all");
    setShowAll(false);
    setExpandedClusters(new Set());

    const slugs = selected.map((s) => s.slug).join(",");
    setLoading(true);
    fetch(`/api/recipes?slugs=${encodeURIComponent(slugs)}&limit=20`)
      .then((r) => r.json())
      .then(async (d) => {
        const results = d.results as ScoredRecipe[];
        setMatches(results);

        const referenced = new Set<string>();
        for (const m of results) {
          for (const s of m.recipe.required) referenced.add(s);
          for (const s of m.recipe.optional ?? []) referenced.add(s);
        }
        const lookup = new Map<string, IngredientSummary>();
        for (const s of selected) {
          lookup.set(s.slug, s);
          ingredientCache.set(s.slug, s);
        }
        const toFetch = [...referenced].filter((s) => !lookup.has(s));
        const fetched = await Promise.all(toFetch.map(fetchIngredient));
        for (const ing of fetched) if (ing) lookup.set(ing.slug, ing);
        setIngredientLookup(lookup);
      })
      .finally(() => setLoading(false));
  }, [selected.map((s) => s.slug).join(",")]);

  if (selected.length === 0) return null;

  const userSlugs = new Set(selected.map((s) => s.slug));

  // Apply filters
  const filtered = matches.filter((m) => {
    if (pantryMode && m.missingRequired.length > 0) return false;
    if (cuisineFilter !== "all" && m.recipe.cuisine !== cuisineFilter) return false;
    if (courseFilter !== "all" && m.recipe.course !== courseFilter) return false;
    return true;
  });

  // Available cuisines (sorted by count desc) — derived from the unfiltered
  // matches so the filter chips don't disappear when you pick one.
  const cuisineCounts = new Map<string, number>();
  for (const m of matches) {
    if (pantryMode && m.missingRequired.length > 0) continue;
    if (m.recipe.cuisine) {
      cuisineCounts.set(m.recipe.cuisine, (cuisineCounts.get(m.recipe.cuisine) ?? 0) + 1);
    }
  }
  const availableCuisines = [...cuisineCounts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );

  // Same idea for courses, respecting pantry mode + active cuisine filter.
  const courseCounts = new Map<string, number>();
  for (const m of matches) {
    if (pantryMode && m.missingRequired.length > 0) continue;
    if (cuisineFilter !== "all" && m.recipe.cuisine !== cuisineFilter) continue;
    if (m.recipe.course) {
      courseCounts.set(m.recipe.course, (courseCounts.get(m.recipe.course) ?? 0) + 1);
    }
  }
  const availableCourses = [...courseCounts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );

  // Cluster info: every match grouped by its matched-ingredient signature so
  // each card can advertise sibling recipes that share the same subset.
  const signatureGroups = new Map<string, ScoredRecipe[]>();
  for (const m of matches) {
    const sig = [...m.matchedRequired].sort().join(",");
    const arr = signatureGroups.get(sig) ?? [];
    arr.push(m);
    signatureGroups.set(sig, arr);
  }
  function signatureOf(m: ScoredRecipe): string {
    return [...m.matchedRequired].sort().join(",");
  }
  function siblingsOf(m: ScoredRecipe): ScoredRecipe[] {
    return (signatureGroups.get(signatureOf(m)) ?? []).filter(
      (s) => s.recipe.id !== m.recipe.id
    );
  }

  // Cuisine inference: weight by match score so a strong Italian top match
  // outweighs a long tail of weaker single-cuisine outliers.
  let totalWeight = 0;
  const weightedCuisines = new Map<string, number>();
  for (const m of matches) {
    if (!m.recipe.cuisine || m.score <= 0) continue;
    weightedCuisines.set(
      m.recipe.cuisine,
      (weightedCuisines.get(m.recipe.cuisine) ?? 0) + m.score
    );
    totalWeight += m.score;
  }
  let inferenceLabel: string | null = null;
  if (totalWeight > 0) {
    const sorted = [...weightedCuisines.entries()]
      .map(([c, w]) => [c, w / totalWeight] as const)
      .sort((a, b) => b[1] - a[1]);
    const [topCuisine, share] = sorted[0] ?? [];
    if (topCuisine && share >= 0.45) {
      inferenceLabel = `Mostly ${cap(topCuisine)}`;
    } else if (topCuisine && share >= 0.25) {
      inferenceLabel = `Leans ${cap(topCuisine)}`;
    }
  }

  const visible = showAll ? filtered : filtered.slice(0, DEFAULT_VISIBLE);
  const hidden = filtered.length - visible.length;

  // Empty states
  if (matches.length === 0 && !loading) {
    return (
      <section>
        <h2 className="text-[11px] uppercase tracking-wider text-muted mb-2">
          Recipes you could make
        </h2>
        <div className="rounded-md border border-border bg-bg p-6 text-sm text-muted">
          No matching recipes for this selection yet. Try removing one of the
          ingredients, or save this combination so you can find it later.
        </div>
      </section>
    );
  }

  return (
    <>
      <section>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h2 className="text-[11px] uppercase tracking-wider text-muted flex items-baseline gap-2 flex-wrap">
            <span>Recipes you could make</span>
            {inferenceLabel && (
              <span
                className="normal-case tracking-normal text-[11px] text-pear/80 font-normal"
                title={`Cuisine inferred from your top recipe matches`}
              >
                {inferenceLabel}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1">
            {loading && <span className="text-xs text-muted mr-2">…</span>}
            <button
              onClick={() => setPantryMode((p) => !p)}
              className={`text-[11px] px-2 py-1 rounded transition flex items-center gap-1 ${
                pantryMode
                  ? "bg-pear/10 text-pear"
                  : "text-muted hover:bg-hover hover:text-ink"
              }`}
              title="Show only recipes you can fully make right now"
            >
              <span className="inline-block w-3 h-3 rounded-sm border border-current">
                {pantryMode && (
                  <span className="block w-2 h-2 m-px bg-current rounded-[1px]" />
                )}
              </span>
              Pantry mode
            </button>
          </div>
        </div>

        {(availableCuisines.length > 1 || cuisineFilter !== "all") && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            <FilterChip
              label="all"
              count={matches.filter((m) => !pantryMode || m.missingRequired.length === 0).length}
              active={cuisineFilter === "all"}
              onClick={() => {
                setCuisineFilter("all");
                setShowAll(false);
              }}
            />
            {availableCuisines.map(([cuisine, count]) => (
              <FilterChip
                key={cuisine}
                label={cuisine}
                count={count}
                active={cuisineFilter === cuisine}
                onClick={() => {
                  setCuisineFilter(cuisine);
                  setShowAll(false);
                }}
              />
            ))}
          </div>
        )}

        {(availableCourses.length > 1 || courseFilter !== "all") && (
          <div className="flex flex-wrap gap-1 mb-3">
            <FilterChip
              label="any course"
              active={courseFilter === "all"}
              onClick={() => {
                setCourseFilter("all");
                setShowAll(false);
              }}
            />
            {availableCourses.map(([course, count]) => (
              <FilterChip
                key={course}
                label={course}
                count={count}
                active={courseFilter === course}
                onClick={() => {
                  setCourseFilter(course);
                  setShowAll(false);
                }}
              />
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-md border border-border bg-bg p-4 text-sm text-muted">
            {pantryMode
              ? "No recipes match all your selected ingredients exactly. Turn off Pantry mode to see partial matches."
              : `No ${cuisineFilter} recipes for this selection.`}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {visible.map((m) => {
                const sig = signatureOf(m);
                const sibs = siblingsOf(m);
                const isExpanded = expandedClusters.has(sig);
                return (
                  <div key={m.recipe.id}>
                    <RecipeCard
                      match={m}
                      ingredientLookup={ingredientLookup}
                      userSlugs={userSlugs}
                      onOpen={() => setOpenRecipe(m.recipe)}
                      savedVersion={savedVersion}
                      siblingCount={sibs.length}
                      isExpanded={isExpanded}
                      onToggleCluster={() => {
                        setExpandedClusters((prev) => {
                          const next = new Set(prev);
                          if (next.has(sig)) next.delete(sig);
                          else next.add(sig);
                          return next;
                        });
                      }}
                    />
                    {isExpanded && sibs.length > 0 && (
                      <div className="ml-6 mt-2 space-y-2 border-l-2 border-border pl-3">
                        {sibs.map((s) => (
                          <RecipeCard
                            key={s.recipe.id}
                            match={s}
                            ingredientLookup={ingredientLookup}
                            userSlugs={userSlugs}
                            onOpen={() => setOpenRecipe(s.recipe)}
                            savedVersion={savedVersion}
                            sibling
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {hidden > 0 && (
              <button
                onClick={() => setShowAll(true)}
                className="mt-2 w-full text-xs text-muted hover:text-ink hover:bg-hover transition py-2 rounded border border-border"
              >
                Show {hidden} more {hidden === 1 ? "recipe" : "recipes"} →
              </button>
            )}
            {showAll && filtered.length > DEFAULT_VISIBLE && (
              <button
                onClick={() => setShowAll(false)}
                className="mt-2 w-full text-xs text-muted hover:text-ink hover:bg-hover transition py-2 rounded"
              >
                Show fewer
              </button>
            )}
          </>
        )}
      </section>

      {openRecipe && (
        <RecipeModal
          recipe={openRecipe}
          userIngredientSlugs={userSlugs}
          ingredientLookup={ingredientLookup}
          onClose={() => setOpenRecipe(null)}
          onUseRecipe={onUseRecipe}
          onChanged={onSavedChanged}
        />
      )}
    </>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded transition inline-flex items-center gap-1.5 ${
        active ? "bg-ink text-bg" : "bg-hover text-muted hover:text-ink"
      }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`text-[10px] tabular-nums ${
            active ? "text-bg/70" : "text-muted/70"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function RecipeCard({
  match,
  ingredientLookup,
  userSlugs,
  onOpen,
  savedVersion,
  siblingCount = 0,
  isExpanded = false,
  onToggleCluster,
  sibling = false,
}: {
  match: ScoredRecipe;
  ingredientLookup: Map<string, IngredientSummary>;
  userSlugs: Set<string>;
  onOpen: () => void;
  savedVersion: number;
  /** how many other recipes hit the same matched-ingredient signature */
  siblingCount?: number;
  /** whether the cluster expander is currently open */
  isExpanded?: boolean;
  /** called when the user clicks "+N similar" to expand/collapse the cluster */
  onToggleCluster?: () => void;
  /** marks this card as a sibling rendered inside an expanded cluster */
  sibling?: boolean;
}) {
  const r = match.recipe;
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isRecipeSaved(r.id));
  }, [r.id, savedVersion]);

  // Sibling cards (rendered inside an expanded cluster) are visually denser.
  const padding = sibling ? "p-3" : "p-3.5";
  const titleSize = sibling ? "text-[13px]" : "text-sm";

  return (
    <div className="relative">
    <button
      onClick={onOpen}
      className={`block w-full text-left border border-border rounded-md ${padding} hover:bg-hover/50 hover:border-border transition`}
    >
      <header className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <h3 className={`font-medium ${titleSize} text-ink flex items-center gap-2 flex-wrap`}>
          {r.name}
          {saved && (
            <span className="text-[10px] font-normal text-pear/80 bg-pear/10 px-1.5 py-0.5 rounded">
              ✓ saved
            </span>
          )}
          {r.source === "themealdb" && (
            <span
              className="text-[10px] font-normal text-muted bg-hover px-1.5 py-0.5 rounded"
              title="Imported from TheMealDB"
            >
              TheMealDB
            </span>
          )}
        </h3>
        <span className="text-xs text-muted">
          {match.matchedRequired.length}/{r.required.length} ingredients
          {r.cuisine ? ` · ${r.cuisine}` : ""}
          {r.time ? ` · ${r.time} min` : ""}
        </span>
      </header>
      {r.about && (
        <p className="text-sm text-muted leading-snug mb-2.5">{r.about}</p>
      )}

      {match.matchedRequired.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {match.matchedRequired.map((slug) => {
            const ing = ingredientLookup.get(slug);
            if (!ing) return null;
            return (
              <span
                key={slug}
                className={`text-xs px-2 py-0.5 rounded inline-flex items-center gap-1 cat-${ing.category}`}
              >
                ✓ {ing.name}
              </span>
            );
          })}
        </div>
      )}
      {match.missingRequired.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[10px] uppercase tracking-wider text-muted/70 mr-1">
            still need:
          </span>
          {match.missingRequired.map((slug) => {
            const ing = ingredientLookup.get(slug);
            if (!ing) return null;
            return (
              <span
                key={slug}
                className="text-xs px-2 py-0.5 rounded bg-hover text-muted"
              >
                + {ing.name}
              </span>
            );
          })}
        </div>
      )}
      <div className="text-xs text-muted/80 mt-2.5">
        Open to view{r.method ? " method," : ""} save, or use these ingredients →
      </div>
    </button>
    {siblingCount > 0 && onToggleCluster && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleCluster();
        }}
        className="mt-1 text-[11px] text-muted hover:text-ink hover:bg-hover transition px-2 py-1 rounded"
        title="Other recipes that use this same subset of your ingredients"
      >
        {isExpanded ? "Hide" : "+"} {siblingCount} similar {siblingCount === 1 ? "recipe" : "recipes"}{" "}
        {isExpanded ? "↑" : "↓"}
      </button>
    )}
    </div>
  );
}
