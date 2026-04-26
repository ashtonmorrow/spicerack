"use client";

import { useState } from "react";
import { IngredientSearch } from "@/components/IngredientSearch";
import { SelectedChips } from "@/components/SelectedChips";
import { PairingsPanel } from "@/components/PairingsPanel";
import { PearLogo } from "@/components/PearLogo";
import { ComboActions } from "@/components/ComboActions";
import { SavedCombos } from "@/components/SavedCombos";
import type { IngredientSummary } from "@/lib/types";

export default function Home() {
  const [selected, setSelected] = useState<IngredientSummary[]>([]);
  // bumped whenever combos change, so children re-read storage and recheck dedup
  const [combosVersion, setCombosVersion] = useState(0);

  function add(ing: IngredientSummary) {
    setSelected((cur) =>
      cur.some((c) => c.slug === ing.slug) ? cur : [...cur, ing]
    );
  }
  function remove(slug: string) {
    setSelected((cur) => cur.filter((c) => c.slug !== slug));
  }
  function loadCombo(ingredients: IngredientSummary[]) {
    setSelected(ingredients);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="mb-10 flex items-start gap-3">
        <PearLogo size={40} className="text-pear shrink-0 mt-0.5" />
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink">
            Flavor Pear
          </h1>
          <p className="text-muted mt-1 text-sm sm:text-base">
            Add ingredients. Get suggestions, fast.
          </p>
        </div>
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

      <PairingsPanel selected={selected} onAdd={add} />

      <SavedCombos
        refreshKey={combosVersion}
        onLoad={loadCombo}
        onChanged={() => setCombosVersion((v) => v + 1)}
      />

      <footer className="mt-16 text-xs text-muted text-center">
        Click any suggestion to chain it on. Press Esc to dismiss the dropdown.
      </footer>
    </main>
  );
}
