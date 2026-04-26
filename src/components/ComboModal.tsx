"use client";

import { useEffect, useRef, useState } from "react";
import type { IngredientSummary } from "@/lib/types";
import { findExactMatch, saveCombo, type SavedCombo } from "@/lib/combos";

interface Props {
  ingredients: IngredientSummary[];
  onClose: () => void;
  onSaved: (combo: SavedCombo) => void;
}

export function ComboModal({ ingredients, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const existing = findExactMatch(ingredients.map((i) => i.slug));

  useEffect(() => {
    nameRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit() {
    if (!name.trim() || existing) return;
    const combo = saveCombo({
      name: name.trim(),
      about: about.trim(),
      ingredients,
    });
    onSaved(combo);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-bg rounded-lg border border-border shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-ink mb-1">
          {existing ? "This combo is already saved" : "Name this combo"}
        </h2>
        <p className="text-sm text-muted mb-4">
          {existing
            ? `You already saved this exact set as "${existing.name}".`
            : "This combination is new to you. Give it a name (and optional notes) so you can find it again."}
        </p>

        <div className="flex flex-wrap gap-1 mb-4">
          {ingredients.map((i) => (
            <span
              key={i.slug}
              className={`text-xs px-2 py-0.5 rounded cat-${i.category}`}
            >
              {i.name}
            </span>
          ))}
        </div>

        {!existing && (
          <>
            <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">
              Name
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="e.g. Caprese, Apple-pork roast"
              className="w-full text-sm px-3 py-2 rounded border border-border bg-bg focus:outline-none focus:border-pear/60 focus:ring-1 focus:ring-pear/40 mb-3"
            />

            <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">
              About <span className="normal-case text-muted/70">(optional)</span>
            </label>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="What is this combo? Why does it work? When do you cook it?"
              rows={3}
              className="w-full text-sm px-3 py-2 rounded border border-border bg-bg focus:outline-none focus:border-pear/60 focus:ring-1 focus:ring-pear/40 resize-none mb-4"
            />
          </>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded text-muted hover:text-ink hover:bg-hover transition"
          >
            {existing ? "Close" : "Cancel"}
          </button>
          {!existing && (
            <button
              onClick={submit}
              disabled={!name.trim()}
              className="text-sm px-3 py-1.5 rounded bg-pear text-white hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save combo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
