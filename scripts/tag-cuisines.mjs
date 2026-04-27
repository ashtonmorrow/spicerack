// One-off script to merge cuisine tags into data/ingredients.json.
// Re-runnable: it merges with existing cuisines arrays so it's safe to add
// more entries here and re-run. Source of truth for the tagging decisions.
//
// Usage: node scripts/tag-cuisines.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const file = path.join(root, "data", "ingredients.json");

// Cuisine tags. Tag where the ingredient's signal is strong enough that its
// presence should nudge inference. Skip tagging "globally common" ingredients
// (garlic, onion, salt, butter) — they live everywhere and add noise.
const TAGS = {
  // Italian core
  tomato: ["italian"],
  basil: ["italian"],
  mozzarella: ["italian"],
  parmesan: ["italian"],
  ricotta: ["italian"],
  burrata: ["italian"],
  prosciutto: ["italian"],
  "balsamic-vinegar": ["italian"],
  pasta: ["italian"],
  polenta: ["italian"],
  oregano: ["italian", "greek", "mexican"],
  "pine-nut": ["italian", "middle-eastern"],
  anchovy: ["italian"],
  capers: ["italian"],

  // French
  shallot: ["french"],
  tarragon: ["french"],
  "brown-butter": ["french"],
  gruyere: ["french"],
  "wine-red": ["french"],
  "wine-white": ["french"],
  duck: ["french"],

  // Greek / Mediterranean
  feta: ["greek"],
  olive: ["greek", "mediterranean"],
  "olive-oil": ["mediterranean", "italian", "greek"],
  yogurt: ["greek", "middle-eastern"],
  cucumber: ["greek", "middle-eastern"],
  lamb: ["mediterranean", "middle-eastern", "greek"],

  // Middle-Eastern / North-African
  tahini: ["middle-eastern"],
  harissa: ["north-african"],
  pomegranate: ["middle-eastern"],
  chickpea: ["middle-eastern"],
  cumin: ["middle-eastern", "indian", "mexican"],
  coriander: ["middle-eastern", "indian"],
  cardamom: ["indian", "middle-eastern"],
  saffron: ["middle-eastern", "spanish", "indian"],
  rose: ["middle-eastern"],
  mint: ["middle-eastern", "greek"],

  // Indian
  turmeric: ["indian"],
  ginger: ["indian", "chinese", "japanese", "thai"],

  // East Asian (Chinese / Japanese / Korean)
  miso: ["japanese"],
  "soy-sauce": ["japanese", "chinese"],
  "sesame-oil": ["japanese", "chinese", "korean"],
  scallion: ["chinese", "japanese", "korean"],
  "five-spice": ["chinese"],
  "vinegar-rice": ["japanese", "chinese"],

  // Southeast Asian (Thai / Vietnamese)
  "fish-sauce": ["thai", "vietnamese"],
  lemongrass: ["thai", "vietnamese"],
  "coconut-milk": ["thai", "indian"],
  cilantro: ["thai", "vietnamese", "mexican", "indian"],
  lime: ["thai", "vietnamese", "mexican"],

  // Mexican
  chili: ["mexican", "thai"],
  avocado: ["mexican"],

  // Scandinavian / Northern
  dill: ["scandinavian"],
  salmon: ["scandinavian", "japanese"],

  // British / American comfort
  cheddar: ["american", "british"],
  bacon: ["american", "british"],
  "maple-syrup": ["american"],
  caramel: ["american"],
  "sweet-potato": ["american"],
};

const data = JSON.parse(fs.readFileSync(file, "utf8"));
let touched = 0;
for (const ing of data.ingredients) {
  const adds = TAGS[ing.slug];
  if (!adds) continue;
  const existing = ing.cuisines ?? [];
  const merged = [...new Set([...existing, ...adds])].sort();
  const sortedExisting = [...existing].sort();
  if (JSON.stringify(merged) !== JSON.stringify(sortedExisting)) {
    ing.cuisines = merged;
    touched++;
  }
}

fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log(
  `Updated ${touched} ingredients (out of ${data.ingredients.length}) with cuisine tags`
);
