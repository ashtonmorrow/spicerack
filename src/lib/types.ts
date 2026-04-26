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

// ----- Recipes -----

export type RecipeSource = "curated" | "themealdb";

export interface Recipe {
  id: string;
  name: string;
  about: string;
  cuisine?: string;
  course?: "starter" | "main" | "side" | "dessert" | "sauce";
  time?: number;          // rough total minutes
  servings?: number | string;
  required: string[];     // ingredient slugs that define the dish
  optional?: string[];    // ingredient slugs that are common but not essential
  method?: string;        // brief generic technique (1–3 sentences)
  tips?: string;          // optional pointer; surfaced subtly in the modal
  source?: RecipeSource;  // where this recipe came from (curated vs imported)
  sourceUrl?: string;     // upstream link for "find recipe online"
}

// What /api/recipes returns: the recipe plus how it scored against the user's
// current ingredient selection.
export interface ScoredRecipe {
  recipe: Recipe;
  score: number;          // ranking score (coverage * matches + optional bonus)
  matchedRequired: string[];  // slugs from `required` that the user already has
  missingRequired: string[];  // slugs from `required` that they don't yet
  matchedOptional: string[];
  coverage: number;       // matchedRequired.length / required.length
}
