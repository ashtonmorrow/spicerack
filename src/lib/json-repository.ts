// JSON-backed implementation of IngredientRepository.
// Loads the seed once, builds in-memory indexes for fast prefix search.

import seed from "../../data/ingredients.json";
import type {
  Ingredient,
  IngredientSummary,
  PairingStrength,
  ScoredPairing,
} from "./types";
import type { IngredientRepository } from "./repository";

interface SeedShape {
  ingredients: Ingredient[];
}

export class JsonIngredientRepository implements IngredientRepository {
  private bySlug: Map<string, Ingredient>;
  private all: Ingredient[];

  constructor() {
    const data = seed as unknown as SeedShape;
    this.all = data.ingredients;
    this.bySlug = new Map(this.all.map((i) => [i.slug, i]));
  }

  async getBySlug(slug: string): Promise<Ingredient | null> {
    return this.bySlug.get(slug) ?? null;
  }

  async list(): Promise<IngredientSummary[]> {
    return this.all
      .map((i) => ({ slug: i.slug, name: i.name, category: i.category }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async search(query: string, limit = 10): Promise<IngredientSummary[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    // Score: prefix-on-name (3) > prefix-on-alias (2) > substring (1).
    const scored: { ing: Ingredient; score: number }[] = [];
    for (const ing of this.all) {
      const name = ing.name.toLowerCase();
      const aliases = ing.aliases?.map((a) => a.toLowerCase()) ?? [];
      let score = 0;
      if (name === q) score = 5;
      else if (name.startsWith(q)) score = 4;
      else if (aliases.some((a) => a === q)) score = 4;
      else if (aliases.some((a) => a.startsWith(q))) score = 3;
      else if (name.includes(q)) score = 2;
      else if (aliases.some((a) => a.includes(q))) score = 1;
      if (score > 0) scored.push({ ing, score });
    }

    return scored
      .sort((a, b) => b.score - a.score || a.ing.name.localeCompare(b.ing.name))
      .slice(0, limit)
      .map(({ ing }) => ({
        slug: ing.slug,
        name: ing.name,
        category: ing.category,
      }));
  }

  async pairingsFor(
    slugs: string[],
    limit = 24
  ): Promise<ScoredPairing[]> {
    const selected = slugs
      .map((s) => this.bySlug.get(s))
      .filter((i): i is Ingredient => Boolean(i));

    if (selected.length === 0) return [];

    // Aggregate pairings across selected ingredients.
    // For each candidate, sum strengths from each selected ingredient that
    // points to it. Ingredients shared across multiple selections rise to top.
    const tally = new Map<
      string,
      { strengthSum: number; hits: number }
    >();

    const selectedSlugs = new Set(selected.map((s) => s.slug));

    for (const ing of selected) {
      for (const p of ing.pairings) {
        if (selectedSlugs.has(p.slug)) continue; // don't suggest what's already picked
        const cur = tally.get(p.slug) ?? { strengthSum: 0, hits: 0 };
        cur.strengthSum += p.strength;
        cur.hits += 1;
        tally.set(p.slug, cur);
      }
    }

    const results: ScoredPairing[] = [];
    for (const [slug, t] of tally) {
      const ing = this.bySlug.get(slug);
      // Soft-handle dangling refs: render as a stub so the UI doesn't break.
      const summary: IngredientSummary = ing
        ? { slug: ing.slug, name: ing.name, category: ing.category }
        : { slug, name: prettySlug(slug), category: "pantry" };

      // Score weights "shared" pairings more heavily so multi-ingredient
      // mode surfaces ingredients that complement EVERYTHING selected.
      const score = t.strengthSum * (1 + (t.hits - 1) * 0.5);

      results.push({
        ingredient: summary,
        score,
        hits: t.hits,
        averageStrength: t.strengthSum / t.hits,
      });
    }

    return results
      .sort((a, b) => b.score - a.score || b.hits - a.hits)
      .slice(0, limit);
  }
}

function prettySlug(slug: string): string {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
