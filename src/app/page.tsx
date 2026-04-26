"use client";

import { useState } from "react";
import Link from "next/link";
import { IngredientSearch } from "@/components/IngredientSearch";
import { SelectedChips } from "@/components/SelectedChips";
import { PairingsPanel } from "@/components/PairingsPanel";
import { PearLetter } from "@/components/PearLetter";
import { ComboActions } from "@/components/ComboActions";
import { SavedCombos } from "@/components/SavedCombos";
import { RecipesPanel } from "@/components/RecipesPanel";
import { SavedRecipes } from "@/components/SavedRecipes";
import type { IngredientSummary } from "@/lib/types";

export default function Home() {
  const [selected, setSelected] = useState<IngredientSummary[]>([]);
  const [combosVersion, setCombosVersion] = useState(0);
  const [savedRecipesVersion, setSavedRecipesVersion] = useState(0);

  const hasSelection = selected.length > 0;

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
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink">
          Flav<span className="text-pear"><PearLetter /></span>r Pear
        </h1>
        <p className="text-muted mt-1 text-sm sm:text-base">
          Add ingredients. Get suggestions and recipes, fast.
        </p>
      </header>

      <div className="mb-4">
        <IngredientSearch
          onPick={add}
          excludeSlugs={selected.map((s) => s.slug)}
        />
      </div>

      <div className="mb-8 min-h-[2rem] flex flex-wrap items-center gap-1.5">
        <SelectedChips
          selected={selected}
          onRemove={remove}
          onClear={() => setSelected([])}
        />
        <ComboActions
          selected={selected}
          combosVersion={combosVersion}
          onSaved={() => setCombosVersion((v) => v + 1)}
        />
      </div>

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
        <PairingsPanel selected={selected} onAdd={add} />
        {hasSelection && (
          <RecipesPanel
            selected={selected}
            onUseRecipe={loadIngredients}
            onSavedChanged={() => setSavedRecipesVersion((v) => v + 1)}
            savedVersion={savedRecipesVersion}
          />
        )}
      </div>

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

      <footer className="mt-16 text-xs text-muted text-center space-y-2">
        <p>Click any suggestion to chain it on. Press Esc to dismiss the dropdown.</p>
        <p>
          <Link href="/privacy" className="hover:text-ink transition">
            Privacy
          </Link>
          <span className="mx-2 opacity-50">·</span>
          <a
            href="https://github.com/ashtonmorrow/spicerack"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink transition"
          >
            Source
          </a>
        </p>
      </footer>
    </main>
  );
}
