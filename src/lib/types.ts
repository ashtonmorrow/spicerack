// Domain types for the flavor-pair app.
// These are deliberately stable so the storage layer (JSON now, DB later)
// can change without rippling through the UI.

export type Category =
  | "fruit"
  | "vegetable"
  | "protein"
  | "herb"
  | "spice"
  | "dairy"
  | "pantry"
  | "nut"
  | "grain"
  | "aromatic";

export type PairingStrength = 1 | 2 | 3; // 1=good, 2=great, 3=classic

export interface PairingRef {
  slug: string;
  strength: PairingStrength;
  note?: string;
}

export interface Ingredient {
  slug: string;
  name: string;
  category: Category;
  aliases?: string[];
  seasons?: ("spring" | "summer" | "fall" | "winter")[];
  cuisines?: string[];
  pairings: PairingRef[];
}

// What the search endpoint returns — light enough to render fast.
export interface IngredientSummary {
  slug: string;
  name: string;
  category: Category;
}

// What the pairings endpoint returns for a given selection.
export interface ScoredPairing {
  ingredient: IngredientSummary;
  score: number;     // aggregated affinity score across selected ingredients
  hits: number;      // how many of the selected ingredients link to this one
  averageStrength: number;
}
