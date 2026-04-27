"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { PearLetter } from "@/components/PearLetter";
import { loadCombos, deleteCombo, type SavedCombo } from "@/lib/combos";
import type { IngredientSummary } from "@/lib/types";

// Combo detail page. Combos live only on this device (localStorage), so
// the page is client-rendered. Visiting on another device shows a not-found
// state — that's expected for now.
//
// Note about params in Next 14.2: client pages can read `params` either as
// a plain object via the function parameter, or via React.use() if the prop
// shape becomes a Promise. We support both shapes safely.
export default function ComboPage({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const resolved =
    typeof (params as Promise<unknown>).then === "function"
      ? (use(params as Promise<{ id: string }>) as { id: string })
      : (params as { id: string });
  const id = resolved.id;

  const [combo, setCombo] = useState<SavedCombo | null | undefined>(undefined);

  useEffect(() => {
    const all = loadCombos();
    setCombo(all.find((c) => c.id === id) ?? null);
  }, [id]);

  if (combo === undefined) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  if (combo === null) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <header className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink hover:opacity-80"
          >
            Flav<span className="text-pear"><PearLetter /></span>r Pear
          </Link>
        </header>
        <h1 className="text-xl font-semibold mb-2">Combo not found</h1>
        <p className="text-sm text-muted leading-relaxed">
          This combo isn't saved on this device. Combos live in your browser's
          localStorage — they don't sync across devices yet. Open on the device
          where you saved it.
        </p>
        <Footer backLink={{ href: "/", label: "← Back to Flavor Pear" }} />
      </main>
    );
  }

  return <ComboDetail combo={combo} onDelete={() => setCombo(null)} />;
}

function ComboDetail({
  combo,
  onDelete,
}: {
  combo: SavedCombo;
  onDelete: () => void;
}) {
  function handleDelete() {
    if (!confirm(`Delete the combo "${combo.name}"?`)) return;
    deleteCombo(combo.id);
    onDelete();
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink hover:opacity-80"
        >
          Flav<span className="text-pear"><PearLetter /></span>r Pear
        </Link>
        <p className="text-xs text-muted mt-1">
          <Link href="/" className="hover:text-ink transition">
            ← Back to ingredient picker
          </Link>
        </p>
      </header>

      <article>
        <div className="flex items-baseline gap-2 mb-2">
          {combo.pinned && (
            <span className="text-xs text-pear" aria-label="pinned">📌</span>
          )}
          <h1 className="text-3xl font-semibold tracking-tight">
            {combo.name}
          </h1>
        </div>
        <p className="text-xs text-muted mb-4">
          Saved {new Date(combo.createdAt).toLocaleDateString()} · this device only
        </p>

        {combo.about && (
          <p className="text-base text-ink leading-relaxed mb-6">
            {combo.about}
          </p>
        )}

        <section className="mb-6">
          <h2 className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">
            Ingredients
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {combo.ingredients.map((i: IngredientSummary) => (
              <span
                key={i.slug}
                className={`text-sm px-2.5 py-1 rounded cat-${i.category}`}
              >
                {i.name}
              </span>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2 mt-8 pt-6 border-t border-border">
          <Link
            href={`/?combo=${combo.id}`}
            className="text-sm px-3 py-1.5 rounded bg-pear text-white hover:brightness-95 transition font-medium"
          >
            Use this combo
          </Link>
          <button
            onClick={handleDelete}
            className="text-sm px-3 py-1.5 rounded text-muted hover:text-ink hover:bg-hover transition ml-auto"
          >
            Delete
          </button>
        </div>
      </article>

      <Footer backLink={{ href: "/", label: "← Back to Flavor Pear" }} />
    </main>
  );
}
