// Validates data files:
//  - every pairing.slug points at a known ingredient
//  - no duplicate slugs
//  - reports asymmetric pairings (A→B but not B→A) as warnings
//  - reports orphan ingredients (no incoming and no outgoing pairings)
//  - every recipe's required/optional slugs point at known ingredients
//  - no duplicate recipe ids

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const data = JSON.parse(
  fs.readFileSync(path.join(root, "data", "ingredients.json"), "utf8")
);

const slugs = new Set();
const dupes = [];
for (const ing of data.ingredients) {
  if (slugs.has(ing.slug)) dupes.push(ing.slug);
  slugs.add(ing.slug);
}

const dangling = []; // pairings that point at unknown slugs
const incoming = new Map(); // slug -> Set of slugs that point AT it
for (const ing of data.ingredients) {
  for (const p of ing.pairings || []) {
    if (!slugs.has(p.slug)) {
      dangling.push({ from: ing.slug, to: p.slug });
    } else {
      const set = incoming.get(p.slug) ?? new Set();
      set.add(ing.slug);
      incoming.set(p.slug, set);
    }
  }
}

const asymmetric = [];
for (const ing of data.ingredients) {
  for (const p of ing.pairings || []) {
    if (!slugs.has(p.slug)) continue;
    const back = incoming.get(ing.slug);
    const target = data.ingredients.find((x) => x.slug === p.slug);
    const backHas = (target?.pairings ?? []).some((bp) => bp.slug === ing.slug);
    if (!backHas) asymmetric.push(`${ing.slug} → ${p.slug} (no reverse)`);
  }
}

const orphans = [];
for (const ing of data.ingredients) {
  const out = (ing.pairings ?? []).length;
  const inc = incoming.get(ing.slug)?.size ?? 0;
  if (out === 0 && inc === 0) orphans.push(ing.slug);
}

const total = data.ingredients.length;
const totalPairings = data.ingredients.reduce(
  (n, i) => n + (i.pairings?.length ?? 0),
  0
);

console.log(`✓ ${total} ingredients, ${totalPairings} pairings`);
if (dupes.length) {
  console.error(`✗ duplicate slugs: ${dupes.join(", ")}`);
}
if (dangling.length) {
  console.error(`✗ ${dangling.length} dangling pairings:`);
  for (const d of dangling) console.error(`    ${d.from} → ${d.to}`);
} else {
  console.log("✓ no dangling pairings");
}
if (orphans.length) {
  console.warn(`! ${orphans.length} orphan ingredients (no links): ${orphans.join(", ")}`);
}
if (asymmetric.length) {
  console.warn(`! ${asymmetric.length} asymmetric pairings (one-way only). First 10:`);
  for (const a of asymmetric.slice(0, 10)) console.warn(`    ${a}`);
}

// ----- recipes.json -----
let recipeProblems = 0;
const recipesPath = path.join(root, "data", "recipes.json");
if (fs.existsSync(recipesPath)) {
  const recipesData = JSON.parse(fs.readFileSync(recipesPath, "utf8"));
  const recipes = recipesData.recipes ?? [];
  const recipeIds = new Set();
  const recipeDupes = [];
  const recipeDangling = [];
  for (const r of recipes) {
    if (recipeIds.has(r.id)) recipeDupes.push(r.id);
    recipeIds.add(r.id);
    for (const slug of r.required ?? []) {
      if (!slugs.has(slug)) recipeDangling.push({ recipe: r.id, slug, kind: "required" });
    }
    for (const slug of r.optional ?? []) {
      if (!slugs.has(slug)) recipeDangling.push({ recipe: r.id, slug, kind: "optional" });
    }
  }
  console.log(`\n✓ ${recipes.length} recipes`);
  if (recipeDupes.length) {
    console.error(`✗ duplicate recipe ids: ${recipeDupes.join(", ")}`);
    recipeProblems += recipeDupes.length;
  }
  if (recipeDangling.length) {
    console.error(`✗ ${recipeDangling.length} recipe ingredients reference unknown slugs:`);
    for (const d of recipeDangling) {
      console.error(`    ${d.recipe} → ${d.slug} (${d.kind})`);
    }
    recipeProblems += recipeDangling.length;
  } else {
    console.log("✓ all recipe ingredients are known");
  }
}

process.exit(dupes.length || dangling.length || recipeProblems ? 1 : 0);
