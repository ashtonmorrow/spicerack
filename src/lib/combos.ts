// LocalStorage-backed CRUD for user-saved ingredient combos.
// Keeping the API small and separate so we can swap to a server-side store later
// (the same way the IngredientRepository is swappable).

import type { IngredientSummary } from "./types";

export interface SavedCombo {
  id: string;
  name: string;
  about: string;
  ingredients: IngredientSummary[];
  pinned?: boolean;
  createdAt: number;
}

const KEY = "flavor-pear:combos";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadCombos(): SavedCombo[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCombo(
  combo: Omit<SavedCombo, "id" | "createdAt">
): SavedCombo {
  const created: SavedCombo = {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    ...combo,
  };
  if (!isBrowser()) return created;
  const all = loadCombos();
  all.unshift(created);
  window.localStorage.setItem(KEY, JSON.stringify(all));
  return created;
}

export function deleteCombo(id: string): void {
  if (!isBrowser()) return;
  const remaining = loadCombos().filter((c) => c.id !== id);
  window.localStorage.setItem(KEY, JSON.stringify(remaining));
}

// Toggle pinned state for a saved combo.
export function togglePinnedCombo(id: string): boolean {
  if (!isBrowser()) return false;
  const all = loadCombos();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  const next = !all[idx].pinned;
  all[idx] = { ...all[idx], pinned: next };
  window.localStorage.setItem(KEY, JSON.stringify(all));
  return next;
}

// Pinned-first, then most-recent-first ordering for UI rendering.
export function loadCombosSorted(): SavedCombo[] {
  return [...loadCombos()].sort((a, b) => {
    if (Boolean(b.pinned) !== Boolean(a.pinned)) {
      return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    }
    return b.createdAt - a.createdAt;
  });
}

// Sort-insensitive exact match. Two combos are "the same" iff their
// ingredient sets are identical, regardless of pick order.
export function findExactMatch(slugs: string[]): SavedCombo | null {
  const key = [...slugs].sort().join(",");
  return (
    loadCombos().find(
      (c) => [...c.ingredients.map((i) => i.slug)].sort().join(",") === key
    ) ?? null
  );
}
