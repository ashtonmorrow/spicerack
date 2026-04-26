"use client";

import { useEffect, useRef, useState } from "react";
import type { IngredientSummary, Recipe } from "@/lib/types";
import {
  deleteSavedRecipe,
  findSavedByRecipeId,
  saveRecipe,
  togglePinnedRecipe,
  updateRecipeNotes,
  type SavedRecipe,
} from "@/lib/saved-recipes";
import { PinIcon } from "./PinIcon";

interface Props {
  recipe: Recipe;
  // Slugs the user currently has selected (used to mark have/missing chips).
  userIngredientSlugs: Set<string>;
  // Resolved {slug → IngredientSummary} for chip rendering of the recipe's
  // required and optional lists.
  ingredientLookup: Map<string, IngredientSummary>;
  onClose: () => void;
  onUseRecipe: (ingredients: IngredientSummary[]) => void;
  // Bumped when the saved-recipes store changes, so peers can re-read.
  onChanged: () => void;
}

export function RecipeModal({
  recipe,
  userIngredientSlugs,
  ingredientLookup,
  onClose,
  onUseRecipe,
  onChanged,
}: Props) {
  const [saved, setSaved] = useState<SavedRecipe | null>(null);
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Re-read the saved entry when the modal opens or after a save/delete action.
  useEffect(() => {
    const existing = findSavedByRecipeId(recipe.id);
    setSaved(existing);
    setNotes(existing?.notes ?? "");
    setNotesDirty(false);
  }, [recipe.id]);

  // Esc-to-close + initial focus.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSave() {
    if (saved) {
      // Already saved — just update notes.
      updateRecipeNotes(saved.id, notes);
      setNotesDirty(false);
    } else {
      const created = saveRecipe(recipe, notes);
      setSaved(created);
      setNotesDirty(false);
    }
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1400);
    onChanged();
  }

  function handleDelete() {
    if (!saved) return;
    deleteSavedRecipe(saved.id);
    setSaved(null);
    setNotes("");
    setNotesDirty(false);
    onChanged();
  }

  function handleTogglePin() {
    if (!saved) return;
    const next = togglePinnedRecipe(saved.id);
    setSaved({ ...saved, pinned: next });
    onChanged();
  }

  function handleUse() {
    const ingredients = recipe.required
      .map((s) => ingredientLookup.get(s))
      .filter((x): x is IngredientSummary => Boolean(x));
    onUseRecipe(ingredients);
    onClose();
  }

  const meta = [
    recipe.cuisine,
    recipe.course,
    recipe.time ? `${recipe.time} min` : null,
    recipe.servings ? `serves ${recipe.servings}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const findUrl = `https://www.google.com/search?q=${encodeURIComponent(
    recipe.name + " recipe"
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/30 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-modal-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-bg rounded-lg border border-border shadow-2xl max-w-xl w-full p-6 my-8 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2
              id="recipe-modal-title"
              className="text-lg font-semibold text-ink"
            >
              {recipe.name}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-muted hover:text-ink hover:bg-hover w-7 h-7 rounded flex items-center justify-center -mr-1 -mt-1 transition shrink-0"
            >
              ×
            </button>
          </div>
          {meta && <p className="text-xs text-muted">{meta}</p>}
        </header>

        {recipe.about && (
          <p className="text-sm text-ink leading-relaxed mb-4">{recipe.about}</p>
        )}

        <Section label="Required">
          <div className="flex flex-wrap gap-1.5">
            {recipe.required.map((slug) => {
              const ing = ingredientLookup.get(slug);
              const have = userIngredientSlugs.has(slug);
              const name = ing?.name ?? slug;
              const cat = ing?.category ?? "pantry";
              return (
                <span
                  key={slug}
                  className={`text-xs px-2 py-0.5 rounded inline-flex items-center gap-1 ${
                    have
                      ? `cat-${cat}`
                      : "bg-hover text-muted line-through decoration-muted/40"
                  }`}
                >
                  {have ? "✓" : "+"} {name}
                </span>
              );
            })}
          </div>
        </Section>

        {recipe.optional && recipe.optional.length > 0 && (
          <Section label="Optional">
            <div className="flex flex-wrap gap-1.5">
              {recipe.optional.map((slug) => {
                const ing = ingredientLookup.get(slug);
                const have = userIngredientSlugs.has(slug);
                const name = ing?.name ?? slug;
                const cat = ing?.category ?? "pantry";
                return (
                  <span
                    key={slug}
                    className={`text-xs px-2 py-0.5 rounded italic ${
                      have
                        ? `cat-${cat}`
                        : "bg-bg text-muted/70 border border-dashed border-border"
                    }`}
                  >
                    {name}
                  </span>
                );
              })}
            </div>
          </Section>
        )}

        {recipe.method && (
          <Section label="Method">
            <p className="text-sm text-ink leading-relaxed">{recipe.method}</p>
          </Section>
        )}

        {recipe.tips && (
          <Section label="Tip">
            <p className="text-sm text-muted leading-relaxed">{recipe.tips}</p>
          </Section>
        )}

        <Section
          label={
            <>
              Your notes
              {saved && <span className="ml-2 normal-case font-normal text-muted/70 tracking-normal">(saved on this device)</span>}
            </>
          }
        >
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setNotesDirty(true);
              setJustSaved(false);
            }}
            placeholder={
              saved
                ? "What worked, what didn't, what you'd do differently..."
                : "Save the recipe to keep personal notes."
            }
            rows={3}
            className="w-full text-sm px-3 py-2 rounded border border-border bg-bg focus:outline-none focus:border-pear/60 focus:ring-1 focus:ring-pear/40 resize-none"
          />
        </Section>

        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-border">
          <button
            onClick={handleUse}
            className="text-sm px-3 py-1.5 rounded bg-pear text-white hover:brightness-95 transition font-medium"
            title="Replace your current selection with this recipe's required ingredients"
          >
            Use this recipe
          </button>

          <button
            onClick={handleSave}
            disabled={Boolean(saved) && !notesDirty}
            className="text-sm px-3 py-1.5 rounded text-ink hover:bg-hover transition disabled:opacity-50 disabled:cursor-not-allowed border border-border"
            title={saved ? "Update your notes" : "Bookmark this recipe"}
          >
            {justSaved ? "✓ Saved" : saved ? (notesDirty ? "Update notes" : "Saved") : "Save recipe"}
          </button>

          <a
            href={findUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-3 py-1.5 rounded text-muted hover:text-ink hover:bg-hover transition"
            title="Search the web for a full recipe"
          >
            Find recipe online ↗
          </a>

          {saved && (
            <button
              onClick={handleTogglePin}
              className={`text-sm px-2.5 py-1.5 rounded transition flex items-center gap-1.5 ${
                saved.pinned
                  ? "text-pear bg-pear/10 hover:bg-pear/15"
                  : "text-muted hover:text-ink hover:bg-hover"
              }`}
              title={saved.pinned ? "Unpin from top" : "Pin to top of saved"}
            >
              <PinIcon filled={Boolean(saved.pinned)} />
              {saved.pinned ? "Pinned" : "Pin"}
            </button>
          )}

          {saved && (
            <button
              onClick={handleDelete}
              className="ml-auto text-xs text-muted hover:text-ink transition px-2 py-1"
            >
              Remove from saved
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <h3 className="text-[11px] uppercase tracking-wider text-muted mb-1.5 font-medium">
        {label}
      </h3>
      {children}
    </div>
  );
}
