"use client";

import { useEffect, useState } from "react";
import { findDuplicateCombos, mergeCombos } from "@/lib/combos";
import {
  findDuplicateRecipes,
  mergeRecipes,
} from "@/lib/saved-recipes";

interface Props {
  /** Bumps when combos change so we re-scan for duplicates. */
  combosVersion: number;
  /** Bumps when saved recipes change. */
  savedRecipesVersion: number;
  /** Called after a merge so the parent can refresh state. */
  onMerged: () => void;
}

// Surfaces saved-combo and saved-recipe duplicate groups with a one-click
// merge action. Hidden when there's nothing to merge.
export function MergeBanner({
  combosVersion,
  savedRecipesVersion,
  onMerged,
}: Props) {
  const [comboDupes, setComboDupes] = useState(0);
  const [recipeDupes, setRecipeDupes] = useState(0);

  useEffect(() => {
    setComboDupes(findDuplicateCombos().length);
  }, [combosVersion]);
  useEffect(() => {
    setRecipeDupes(findDuplicateRecipes().length);
  }, [savedRecipesVersion]);

  const total = comboDupes + recipeDupes;
  if (total === 0) return null;

  function mergeAll() {
    for (const g of findDuplicateCombos()) mergeCombos(g);
    for (const g of findDuplicateRecipes()) mergeRecipes(g);
    onMerged();
  }

  return (
    <section className="mt-10 mb-2 border border-pear/30 bg-pear/5 rounded-md p-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="text-sm text-ink">
        <strong className="font-medium">
          {total} duplicate {total === 1 ? "group" : "groups"} found
        </strong>{" "}
        <span className="text-muted">
          ({comboDupes > 0 && `${comboDupes} combo${comboDupes === 1 ? "" : "s"}`}
          {comboDupes > 0 && recipeDupes > 0 && ", "}
          {recipeDupes > 0 && `${recipeDupes} recipe${recipeDupes === 1 ? "" : "s"}`}
          ). Merging keeps notes, pinned state, and the oldest record's id.
        </span>
      </div>
      <button
        onClick={mergeAll}
        className="text-sm px-3 py-1.5 rounded bg-pear text-white hover:brightness-95 transition font-medium shrink-0"
      >
        Merge all
      </button>
    </section>
  );
}
