"use client";

import { useEffect, useRef, useState } from "react";
import type { IngredientSummary, ScoredPairing } from "@/lib/types";

// Items shown in the dropdown can carry extra signal when they're pairing
// suggestions (affinity dots, multi-hit count). Plain search results don't.
type Item = IngredientSummary & { dots?: number; hits?: number };
type Mode = "starters" | "pairings" | "search";

interface Props {
  onPick: (ingredient: IngredientSummary) => void;
  excludeSlugs: string[];
}

// Common starting ingredients for an empty selection. Keeps the dropdown
// useful from the very first focus.
const STARTER_SLUGS = [
  "tomato", "chicken", "garlic", "lemon",
  "basil", "onion", "salmon", "apple",
];

export function IngredientSearch({ onPick, excludeSlugs }: Props) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<Mode>("starters");
  const [highlight, setHighlight] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const excludedKey = excludeSlugs.join(",");

  // One effect, three modes. The mode is determined by inputs, not by setState
  // sequencing, so there's no race between "search" and "pairings" effects.
  useEffect(() => {
    let cancelled = false;
    const excluded = new Set(excludeSlugs);
    const trimmed = q.trim();

    if (trimmed) {
      // Search mode — debounced
      const t = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/ingredients?q=${encodeURIComponent(trimmed)}&limit=8`
          );
          const data = await res.json();
          if (cancelled) return;
          const filtered: Item[] = (data.results as IngredientSummary[]).filter(
            (r) => !excluded.has(r.slug)
          );
          setItems(filtered);
          setMode("search");
          setHighlight(0);
        } catch {
          if (!cancelled) setItems([]);
        }
      }, 60);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }

    if (excludeSlugs.length === 0) {
      // Starters
      Promise.all(
        STARTER_SLUGS.map((s) =>
          fetch(`/api/ingredients?q=${s}&limit=1`)
            .then((r) => r.json())
            .then((d) => d.results[0] as IngredientSummary | undefined)
        )
      ).then((arr) => {
        if (cancelled) return;
        const filtered = arr
          .filter((x): x is IngredientSummary => Boolean(x))
          .filter((x) => !excluded.has(x.slug));
        setItems(filtered);
        setMode("starters");
        setHighlight(0);
      });
      return () => {
        cancelled = true;
      };
    }

    // Pairings mode — fetch and decorate with affinity hints
    const slugs = encodeURIComponent(excludeSlugs.join(","));
    fetch(`/api/pairings?slugs=${slugs}&limit=10`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const arr: Item[] = (d.results as ScoredPairing[]).map((p) => ({
          slug: p.ingredient.slug,
          name: p.ingredient.name,
          category: p.ingredient.category,
          dots: Math.min(3, Math.round(p.averageStrength)),
          hits: p.hits,
        }));
        setItems(arr);
        setMode("pairings");
        setHighlight(0);
      });
    return () => {
      cancelled = true;
    };
  }, [q, excludedKey]);

  function pick(item: IngredientSummary) {
    onPick(item);
    setQ("");
    // Clear items immediately so the dropdown doesn't briefly show the
    // just-picked item before the effect re-fetches.
    setItems([]);
    setMode("starters");
    setHighlight(0);
    // Stay focused for rapid-fire add.
    inputRef.current?.focus();
    setOpen(true);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length === 0) return;
      setHighlight((h) => (h + 1) % items.length);
      if (!open) setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length === 0) return;
      setHighlight((h) => (h - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      if (items[highlight]) {
        e.preventDefault();
        pick(items[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const headerLabel =
    mode === "search"
      ? null
      : mode === "pairings"
      ? `Top pairings for your selection`
      : "Start with one of these";

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={
          excludeSlugs.length === 0
            ? "Add an ingredient — apple, salmon, cumin…"
            : "Add another ingredient…"
        }
        className="w-full text-base px-4 py-3 rounded-md border border-border bg-bg text-ink placeholder:text-muted focus:outline-none focus:border-pear/60 focus:ring-1 focus:ring-pear/40 transition"
        autoComplete="off"
        spellCheck={false}
        autoFocus
      />
      {open && items.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-bg rounded-md border border-border shadow-md overflow-hidden">
          {headerLabel && (
            <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-muted border-b border-border bg-hover flex items-center justify-between">
              <span>{headerLabel}</span>
              <span className="normal-case tracking-normal text-muted/80">
                ↵ to add · Esc to close
              </span>
            </div>
          )}
          <ul role="listbox">
            {items.map((r, i) => (
              <li
                key={r.slug}
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(r);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer ${
                  i === highlight ? "bg-hover" : "bg-bg"
                }`}
              >
                <span className="text-sm">{r.name}</span>
                <span className="flex items-center gap-2">
                  {r.dots !== undefined && (
                    <span className="text-[10px] tracking-tighter text-muted">
                      {"●".repeat(r.dots) + "○".repeat(3 - r.dots)}
                    </span>
                  )}
                  {r.hits !== undefined && r.hits > 1 && (
                    <span className="text-[10px] bg-selected text-ink px-1.5 py-0.5 rounded-full font-semibold">
                      ×{r.hits}
                    </span>
                  )}
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded cat-${r.category}`}
                  >
                    {r.category}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
