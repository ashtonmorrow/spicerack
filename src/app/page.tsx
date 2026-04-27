"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { loadCombos } from "@/lib/combos";
import { IngredientSearch } from "@/components/IngredientSearch";
import { SelectedChips } from "@/components/SelectedChips";
import { PairingsPanel } from "@/components/PairingsPanel";
import { PearLetter } from "@/components/PearLetter";
import { ComboActions } from "@/components/ComboActions";
import { SavedCombos } from "@/components/SavedCombos";
import { RecipesPanel } from "@/components/RecipesPanel";
import { SavedRecipes } from "@/components/SavedRecipes";
import { ClusterStrip } from "@/components/ClusterStrip";
import { MergeBanner } from "@/components/MergeBanner";
import { Footer } from "@/components/Footer";
import { analyzeSelection } from "@/lib/clusters";
import type { IngredientSummary, ScoredRecipe } from "@/lib/types";

export default function HomePage() {
  // useSearchParams must be inside a Suspense boundary in Next.js 14 App Router.
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}

function Home() {
  const searchParams = useSearchParams();
  const useRecipeId = searchParams.get("use");
  const useComboId = searchParams.get("combo");

  const [selected, setSelected] = useState<IngredientSummary[]>([]);
  const [combosVersion, setCombosVersion] = useState(0);
  const [savedRecipesVersion, setSavedRecipesVersion] = useState(0);

  // Match list bubbles up from RecipesPanel so the cluster analysis can run
  // on the same source the recipes UI is showing.
  const [matches, setMatches] = useState<ScoredRecipe[]>([]);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);

  const hasSelection = selected.length > 0;

  // Re-analyze whenever the selection or matches change. Pure function — no
  // network calls — so this is cheap.
  const analysis = useMemo(
    () => analyzeSelection(selected.map((s) => s.slug), matches),
    [selected.map((s) => s.slug).join(","), matches]
  );

  // If the active cluster disappears (because the user changed their selection
  // and the cluster no longer exists), drop the filter.
  useEffect(() => {
    if (activeClusterId && !analysis.clusters.some((c) => c.id === activeClusterId)) {
      setActiveClusterId(null);
    }
  }, [activeClusterId, analysis.clusters]);

  // ?use=<recipe-id> deep link: when the home page loads with this param (e.g.
  // user clicked "Use these ingredients" on a recipe page), load the recipe's
  // required ingredients into the selection. Runs once on mount per `use` value.
  useEffect(() => {
    if (!useRecipeId) return;
    let cancelled = false;
    (async () => {
      try {
        // Fetch the recipe via /api/recipes? — we don't have a getById endpoint
        // public-facing yet, but we can use /api/ingredients to resolve slugs
        // once we have the recipe's required[]. For now, fetch the recipe's
        // page metadata via a generic recipes call: cheap workaround is to
        // fetch all recipes and find by id.
        const res = await fetch(`/api/recipe-by-id?id=${encodeURIComponent(useRecipeId)}`);
        if (!res.ok) return;
        const data = await res.json();
        const required: string[] = data.recipe?.required ?? [];
        if (!required.length) return;
        // Resolve to summaries via the ingredients endpoint
        const ings = await Promise.all(
          required.map(async (slug) => {
            const r = await fetch(`/api/ingredients?q=${slug}&limit=1`);
            const d = await r.json();
            return (d.results as IngredientSummary[]).find((i) => i.slug === slug);
          })
        );
        if (cancelled) return;
        const filtered = ings.filter(
          (i): i is IngredientSummary => Boolean(i)
        );
        if (filtered.length) setSelected(filtered);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [useRecipeId]);

  // ?combo=<id> deep link: load the saved combo's ingredients on arrival.
  useEffect(() => {
    if (!useComboId) return;
    const combo = loadCombos().find((c) => c.id === useComboId);
    if (combo) setSelected(combo.ingredients);
  }, [useComboId]);

  const activeCluster =
    activeClusterId
      ? analysis.clusters.find((c) => c.id === activeClusterId) ?? null
      : null;
  const clusterFilter = activeCluster ? activeCluster.ingredients : null;

  // Lookup map for cluster strip + chips, derived from the live selection.
  const ingredientLookup = useMemo(() => {
    const m = new Map<string, IngredientSummary>();
    for (const s of selected) m.set(s.slug, s);
    // Recipes contribute additional names too, since cluster.ingredients can
    // include slugs the user has — they always do, but lookup will fall back
    // to the slug itself if missing.
    return m;
  }, [selected]);

  // Visual signals for the chips row.
  const outlierSet = useMemo(() => new Set(analysis.outliers), [analysis.outliers]);
  const dimmedSet = useMemo(() => {
    if (!clusterFilter) return new Set<string>();
    const cluster = new Set(clusterFilter);
    return new Set(selected.map((s) => s.slug).filter((s) => !cluster.has(s)));
  }, [clusterFilter, selected]);

  function add(ing: IngredientSummary) {
    setSelected((cur) =>
      cur.some((c) => c.slug === ing.slug) ? cur : [...cur, ing]
    );
  }
  function remove(slug: string) {
    setSelected((cur) => cur.filter((c) => c.slug !== slug));
  }
  function loadIngredients(ingredients: IngredientSummary[]) {
    setSelected(ingredients);
    setActiveClusterId(null);
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink">
          Flav<span className="text-pear"><PearLetter /></span>r Pare
        </h1>
        <p className="text-muted mt-1 text-sm sm:text-base">
          Pare down what you have to figure out what to cook quickly.
        </p>
      </header>

      <div className="mb-4">
        <IngredientSearch
          onPick={add}
          excludeSlugs={selected.map((s) => s.slug)}
        />
      </div>

      <div className="mb-6 min-h-[2rem] flex flex-wrap items-center gap-1.5">
        <SelectedChips
          selected={selected}
          onRemove={remove}
          onClear={() => setSelected([])}
          outlierSlugs={outlierSet}
          dimmedSlugs={dimmedSet}
        />
        <ComboActions
          selected={selected}
          combosVersion={combosVersion}
          onSaved={() => setCombosVersion((v) => v + 1)}
        />
      </div>

      {hasSelection && (
        <ClusterStrip
          analysis={analysis}
          ingredientLookup={ingredientLookup}
          activeClusterId={activeClusterId}
          onSelectCluster={setActiveClusterId}
          selectedSlugs={selected.map((s) => s.slug)}
          onAdd={add}
        />
      )}

      {/* Main two panels: pairings on the left, recipes on the right.
          Side-by-side at lg+ so the user can watch both update live as they
          add ingredients. Stacks on smaller screens. */}
      <div
        className={
          hasSelection
            ? "grid gap-4 lg:gap-6 lg:grid-cols-2 items-start"
            : ""
        }
      >
        <PairingsPanel
          selected={selected}
          onAdd={add}
          clusterFilter={clusterFilter}
        />
        {hasSelection && (
          <RecipesPanel
            selected={selected}
            onUseRecipe={loadIngredients}
            onSavedChanged={() => setSavedRecipesVersion((v) => v + 1)}
            savedVersion={savedRecipesVersion}
            onMatches={setMatches}
            clusterFilter={clusterFilter}
          />
        )}
      </div>

      <MergeBanner
        combosVersion={combosVersion}
        savedRecipesVersion={savedRecipesVersion}
        onMerged={() => {
          setCombosVersion((v) => v + 1);
          setSavedRecipesVersion((v) => v + 1);
        }}
      />

      {/* Saved sections: also two-up, parallel structure. */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2 items-start">
        <SavedCombos
          refreshKey={combosVersion}
          onLoad={loadIngredients}
          onChanged={() => setCombosVersion((v) => v + 1)}
        />
        <SavedRecipes
          refreshKey={savedRecipesVersion}
          onLoad={loadIngredients}
          onChanged={() => setSavedRecipesVersion((v) => v + 1)}
        />
      </div>

      <Footer hint="Click any suggestion to chain it on. Press Esc to dismiss the dropdown." />
    </main>
  );
}
