// GET /api/surprise → { ingredients: IngredientSummary[] }
//
// Picks a coherent random selection of 4–5 ingredients seeded from a seasonal
// (or otherwise interesting) anchor, then layered with that anchor's
// strongest curated pairings. The point: one click and the user sees the
// clustering + recipes + pairings all working at once.
//
// Algorithm:
//   1. Pick an anchor — biased toward seasonal ingredients when available so
//      surprises feel fresh, but always falls back to any ingredient.
//   2. Walk the anchor's curated pairings ordered by strength.
//   3. Pick the top 3–4 that span at least 2 different categories so the
//      result doesn't degenerate to "5 spices" or "5 vegetables".
//   4. Return [anchor, ...picks].

import { NextResponse } from "next/server";
import { getRepository, type Season } from "@/lib/repository";
import seed from "../../../../data/ingredients.json";
import type { Ingredient, IngredientSummary } from "@/lib/types";

interface SeedShape { ingredients: Ingredient[]; }
const data = seed as unknown as SeedShape;
const bySlug = new Map<string, Ingredient>(
  data.ingredients.map((i) => [i.slug, i])
);

function currentSeason(now = new Date()): Season {
  const m = now.getMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "fall";
  return "winter";
}

function pickAnchor(): Ingredient {
  const season = currentSeason();
  // Prefer anchors that (a) are in season, (b) have a respectable pairing
  // graph (≥4 pairings) so we can build a coherent selection. Filter, then
  // random pick. If the seasonal pool is empty, fall back to any
  // well-paired ingredient.
  const seasonal = data.ingredients.filter(
    (i) => i.seasons?.includes(season) && i.pairings.length >= 4
  );
  const pool = seasonal.length > 0
    ? seasonal
    : data.ingredients.filter((i) => i.pairings.length >= 6);
  return pool[Math.floor(Math.random() * pool.length)];
}

function toSummary(i: Ingredient): IngredientSummary {
  return {
    slug: i.slug,
    name: i.name,
    category: i.category,
    ...(i.cuisines?.length ? { cuisines: i.cuisines } : {}),
  };
}

function buildSurprise(): IngredientSummary[] {
  const anchor = pickAnchor();
  // Pairings ordered by strength (desc). Take strong ones, then pick a few
  // with category variety so the selection feels like a dish, not a list.
  const sortedPairings = [...anchor.pairings].sort(
    (a, b) => b.strength - a.strength
  );

  const selected: Ingredient[] = [anchor];
  const seenCategories = new Set<string>([anchor.category]);
  // First pass: prefer category-diverse strong pairings.
  for (const p of sortedPairings) {
    if (selected.length >= 5) break;
    const cand = bySlug.get(p.slug);
    if (!cand) continue;
    if (selected.some((s) => s.slug === cand.slug)) continue;
    if (seenCategories.has(cand.category)) continue;
    selected.push(cand);
    seenCategories.add(cand.category);
  }
  // Second pass: top off to 4–5 even if categories repeat.
  if (selected.length < 4) {
    for (const p of sortedPairings) {
      if (selected.length >= 5) break;
      const cand = bySlug.get(p.slug);
      if (!cand) continue;
      if (selected.some((s) => s.slug === cand.slug)) continue;
      selected.push(cand);
    }
  }
  return selected.map(toSummary);
}

export async function GET() {
  // Repo isn't strictly required here — we use the raw data so we can read
  // pairings directly — but ensure init for symmetry with other routes.
  getRepository();
  const ingredients = buildSurprise();
  return NextResponse.json({ ingredients });
}
