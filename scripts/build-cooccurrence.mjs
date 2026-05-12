// Builds data/cooccurrence.json from the recipe corpus.
//
// For every pair of ingredients (a, b) appearing in ≥2 recipes together,
// compute a normalized score that captures "these go together in real dishes."
// This complements the curated pairings (cultural) and Ahn et al. compound
// similarity (chemical) with a recipe-context signal — what FlavorGraph
// learns end-to-end, derived directly from our own catalog.
//
// Score formula: cooccurrence_score(a, b) = co(a,b) / sqrt(freq(a) * freq(b))
// where co(a,b) is the number of recipes containing both, freq(x) is the
// number containing x. This is the Ochiai coefficient — a normalized
// co-occurrence measure that doesn't bias toward common ingredients.
//
// Run: node scripts/build-cooccurrence.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const curatedRecipes = JSON.parse(
  fs.readFileSync(path.join(root, "data", "recipes.json"), "utf8")
).recipes;
const mdbRecipes = JSON.parse(
  fs.readFileSync(path.join(root, "data", "recipes-themealdb.json"), "utf8")
).recipes;
const ingredients = JSON.parse(
  fs.readFileSync(path.join(root, "data", "ingredients.json"), "utf8")
).ingredients;

const knownSlugs = new Set(ingredients.map((i) => i.slug));
const recipes = [...curatedRecipes, ...mdbRecipes];

// Count per-slug recipe frequency.
const freq = new Map();
// Count per-pair co-occurrence.
const co = new Map();
function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

for (const r of recipes) {
  const slugs = [...new Set([...(r.required || []), ...(r.optional || [])])]
    .filter((s) => knownSlugs.has(s));
  for (const s of slugs) freq.set(s, (freq.get(s) ?? 0) + 1);
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const k = pairKey(slugs[i], slugs[j]);
      co.set(k, (co.get(k) ?? 0) + 1);
    }
  }
}

// Build the output. Only keep pairs with co ≥ 2 — single-co-occurrences are
// noise; we want pairs that show up together repeatedly. Compute Ochiai
// coefficient (cosine-normalized co-occurrence) so common ingredients don't
// dominate. Drop pairs with score < 0.10 — that's the floor below which the
// signal is too weak to merit storing.
const MIN_CO = 2;
const MIN_SCORE = 0.1;
const byIngredient = {};

let totalEdges = 0;
let droppedLowCo = 0;
let droppedLowScore = 0;
for (const [k, c] of co) {
  if (c < MIN_CO) {
    droppedLowCo++;
    continue;
  }
  const [a, b] = k.split("|");
  const fa = freq.get(a) ?? 1;
  const fb = freq.get(b) ?? 1;
  const score = c / Math.sqrt(fa * fb);
  if (score < MIN_SCORE) {
    droppedLowScore++;
    continue;
  }
  // Store both directions so lookup is O(1) without re-keying.
  (byIngredient[a] ??= {})[b] = score;
  (byIngredient[b] ??= {})[a] = score;
  totalEdges++;
}

const output = {
  $schema_version: 1,
  source: "Computed from data/recipes.json + data/recipes-themealdb.json",
  generated_at: new Date().toISOString(),
  notes: "Ochiai coefficient: co(a,b) / sqrt(freq(a)*freq(b)). Pairs with co<2 or score<0.10 dropped.",
  byIngredient,
};

fs.writeFileSync(
  path.join(root, "data", "cooccurrence.json"),
  JSON.stringify(output) + "\n"
);

const ingredientCount = Object.keys(byIngredient).length;
console.log(`Recipes analyzed: ${recipes.length}`);
console.log(`Distinct ingredients seen: ${freq.size}`);
console.log(`Pairs kept: ${totalEdges} (dropped ${droppedLowCo} for co<${MIN_CO}, ${droppedLowScore} for score<${MIN_SCORE})`);
console.log(`Ingredients with at least one co-occurrence edge: ${ingredientCount}`);

// Print a few sample top edges so we can sanity-check.
const sample = [];
for (const [a, neighbors] of Object.entries(byIngredient)) {
  for (const [b, s] of Object.entries(neighbors)) {
    if (a < b) sample.push({ a, b, s });
  }
}
sample.sort((x, y) => y.s - x.s);
console.log("\nTop 10 co-occurrence pairs:");
for (const e of sample.slice(0, 10)) console.log(`  ${e.a} ↔ ${e.b}: ${e.s.toFixed(3)}`);
