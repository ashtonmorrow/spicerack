// Repository pattern: the rest of the app talks to this interface.
// Today the only implementation is JSON-backed; tomorrow it can be Postgres,
// SQLite, or a remote API — no caller changes required.

import type {
  AnchorSuggestion,
  Ingredient,
  IngredientSummary,
  ScoredPairing,
} from "./types";

export interface IngredientRepository {
  getBySlug(slug: string): Promise<Ingredient | null>;
  search(query: string, limit?: number): Promise<IngredientSummary[]>;
  list(): Promise<IngredientSummary[]>;
  pairingsFor(slugs: string[], limit?: number): Promise<ScoredPairing[]>;
  /** Bridge-aware anchor suggestions: candidates that pair with the outlier
   *  AND ideally also pair with ingredients in `selectionSlugs`. */
  anchorsFor(
    outlierSlug: string,
    selectionSlugs: string[],
    limit?: number
  ): Promise<AnchorSuggestion[]>;
}

// Singleton accessor — swap implementations here.
import { JsonIngredientRepository } from "./json-repository";

let repo: IngredientRepository | null = null;

export function getRepository(): IngredientRepository {
  if (!repo) {
    repo = new JsonIngredientRepository();
  }
  return repo;
}
