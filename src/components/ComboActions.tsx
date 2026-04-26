"use client";

import { useEffect, useState } from "react";
import type { IngredientSummary } from "@/lib/types";
import { findExactMatch } from "@/lib/combos";
import { ComboModal } from "./ComboModal";

interface Props {
  selected: IngredientSummary[];
  combosVersion: number; // bump when combos change so we re-check existence
  onSaved: () => void;
}

// Shows a "+ Save as combo" prompt next to the chips when 2+ ingredients are
// selected and this exact set hasn't been saved yet — the "novel group" cue.
export function ComboActions({ selected, combosVersion, onSaved }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [alreadySavedAs, setAlreadySavedAs] = useState<string | null>(null);

  useEffect(() => {
    if (selected.length < 2) {
      setAlreadySavedAs(null);
      return;
    }
    const existing = findExactMatch(selected.map((s) => s.slug));
    setAlreadySavedAs(existing?.name ?? null);
  }, [selected.map((s) => s.slug).join(","), combosVersion]);

  if (selected.length < 2) return null;

  if (alreadySavedAs) {
    return (
      <span className="text-xs text-muted px-2 py-1">
        Saved as <span className="font-medium text-ink">{alreadySavedAs}</span>
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="text-xs text-pear hover:bg-hover px-2 py-1 rounded transition font-medium"
        title="Save this combination so you can find it again"
      >
        + Save as combo
      </button>
      {modalOpen && (
        <ComboModal
          ingredients={selected}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            onSaved();
          }}
        />
      )}
    </>
  );
}
