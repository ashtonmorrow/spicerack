// One-off script to layer seasonal tags onto data/ingredients.json.
// Re-runnable: merges with existing seasons arrays so it's safe to add more
// entries here and re-run. Tag where the ingredient has a clearly dominant
// seasonal peak — skip year-round pantry staples.
//
// Usage: node scripts/tag-seasons.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const file = path.join(root, "data", "ingredients.json");

// Northern-hemisphere temperate seasons. Tag two seasons when an ingredient
// peaks across a boundary (e.g. citrus peaks late fall through winter).
const TAGS = {
  // Spring
  asparagus: ["spring"],
  pea: ["spring"],
  artichoke: ["spring"],
  rhubarb: ["spring"],
  morel: ["spring"],
  strawberry: ["spring", "summer"],

  // Summer
  tomato: ["summer"],
  zucchini: ["summer"],
  corn: ["summer"],
  cherry: ["summer"],
  watermelon: ["summer"],
  melon: ["summer"],
  blueberry: ["summer"],
  raspberry: ["summer"],
  peach: ["summer"],
  basil: ["summer"],
  mint: ["summer", "spring"],
  cucumber: ["summer"],
  eggplant: ["summer"],

  // Fall
  apple: ["fall"],
  pear: ["fall", "winter"],
  fig: ["summer", "fall"],
  "butternut-squash": ["fall", "winter"],
  "brussels-sprout": ["fall", "winter"],
  pomegranate: ["fall", "winter"],
  "sweet-potato": ["fall", "winter"],
  beet: ["fall"],
  fennel: ["fall", "winter"],
  cauliflower: ["fall", "winter"],
  broccoli: ["fall", "winter"],

  // Winter (citrus peaks late fall through winter in temperate growing regions)
  lemon: ["winter"],
  orange: ["winter"],
  leek: ["winter", "fall"],
  parsnip: ["winter"],
  kale: ["winter", "fall"],
  carrot: ["fall", "winter"],
  potato: ["fall", "winter"],
};

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const bySlug = new Map(data.ingredients.map((i) => [i.slug, i]));

let touched = 0;
let skipped = 0;
for (const [slug, seasons] of Object.entries(TAGS)) {
  const ing = bySlug.get(slug);
  if (!ing) {
    skipped++;
    continue;
  }
  const existing = ing.seasons ?? [];
  const merged = [...new Set([...existing, ...seasons])];
  // Sort in canonical season order for readability.
  const order = ["spring", "summer", "fall", "winter"];
  merged.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const sortedExisting = [...existing].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  if (JSON.stringify(merged) !== JSON.stringify(sortedExisting)) {
    ing.seasons = merged;
    touched++;
  }
}

fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");

const totalTagged = data.ingredients.filter((i) => i.seasons && i.seasons.length).length;
console.log(
  `Updated ${touched} ingredients with seasonal tags (${skipped} slugs unknown).`
);
console.log(`Total seasonally-tagged: ${totalTagged} / ${data.ingredients.length}`);

// Print distribution.
const tally = { spring: 0, summer: 0, fall: 0, winter: 0 };
for (const ing of data.ingredients) {
  for (const s of ing.seasons ?? []) tally[s] = (tally[s] || 0) + 1;
}
console.log("Distribution:", tally);
