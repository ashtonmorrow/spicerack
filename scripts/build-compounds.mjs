// Builds data/compound-data.json from the Ahn et al. flavor network dataset
// (Scientific Reports, 2011). Subsets to ingredients we already have in our
// catalog and writes a slim file: { compounds: {id: name}, byIngredient: {slug: [compoundId...]} }.
//
// Run once and commit the output. To refresh, re-run after fetching the
// upstream TSVs to /tmp/ahn or any local path you point AHN_DIR at.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const AHN = process.env.AHN_DIR || "/tmp/ahn";

function readTsv(name) {
  const text = fs.readFileSync(path.join(AHN, name), "utf8");
  return text
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("\t"));
}

// Our ingredient catalog → slug + aliases
const seed = JSON.parse(
  fs.readFileSync(path.join(root, "data", "ingredients.json"), "utf8")
);
const knownSlugs = new Set(seed.ingredients.map((i) => i.slug));
const nameToSlug = new Map();
for (const ing of seed.ingredients) {
  nameToSlug.set(ing.name.toLowerCase(), ing.slug);
  nameToSlug.set(ing.slug, ing.slug);
  nameToSlug.set(ing.slug.replace(/-/g, " "), ing.slug);
  for (const alias of ing.aliases ?? []) {
    nameToSlug.set(alias.toLowerCase(), ing.slug);
  }
}

// Ahn ingredient names use snake_case. Map them to our slugs.
// A small manual override table covers cases where their name and ours diverge.
const MANUAL = {
  wine: "wine-red", // they use one "wine"; map to red as default
  egg: "egg",
  cheese: "parmesan", // very generic; map to most common
  black_pepper: "black-pepper",
  bell_pepper: null, // we don't have it
  olive_oil: "olive-oil",
  brown_rice: "rice",
  white_bread: "bread",
  sour_cream: "sour-cream",
  blue_cheese: "blue-cheese",
  goat_cheese: "goat-cheese",
  cottage_cheese: "ricotta", // close enough
  cream_cheese: "cream",
  greek_yogurt: "yogurt",
  butter_milk: "milk",
  butter_oil: "butter",
  brown_butter: "brown-butter",
  apple_brandy: null,
  apple_juice: "apple",
  apple_cider: "apple",
  vanilla: "vanilla",
  vanilla_bean: "vanilla",
  vanilla_ice_cream: null,
  citrus_peel: "lemon", // generic
  lemon_peel: "lemon",
  orange_peel: "orange",
  lime_peel: "lime",
  green_bell_pepper: null,
  red_bell_pepper: null,
  jasmine_rice: "rice",
  white_wine: "wine-white",
  red_wine: "wine-red",
  cured_pork: "bacon",
  smoked_salmon: "salmon",
  whiskey: "bourbon",
  star_anise: "anise",
  five_spice: "five-spice",
  scallion: "scallion",
  green_onion: "scallion",
  spring_onion: "scallion",
  pine_nut: "pine-nut",
  pumpkin: "butternut-squash",
  sweet_potato: "sweet-potato",
  butternut_squash: "butternut-squash",
  bay_leaf: "bay-leaf",
  bay: "bay-leaf",
  parmesan_cheese: "parmesan",
  cheddar_cheese: "cheddar",
  feta_cheese: "feta",
  mozzarella_cheese: "mozzarella",
  ricotta_cheese: "ricotta",
  gruyere: "gruyere",
  brussels_sprout: "brussels-sprout",
  green_pea: "pea",
  pea: "pea",
  fish: "fish-white",
  white_fish: "fish-white",
  cod: "fish-white",
  haddock: "fish-white",
  halibut: "fish-white",
  prawn: "shrimp",
  ham: "ham",
  prosciutto: "prosciutto",
  white_bean: "bean-white",
  cannellini_bean: "bean-white",
  rice_vinegar: "vinegar-rice",
  red_wine_vinegar: "vinegar-red-wine",
  wine_vinegar: "vinegar-red-wine",
  balsamic_vinegar: "balsamic-vinegar",
  soybean_oil: null, // skip
  sesame_oil: "sesame-oil",
  fish_sauce: "fish-sauce",
  soy_sauce: "soy-sauce",
  miso: "miso",
  tahini: "tahini",
  honey: "honey",
  maple_syrup: "maple-syrup",
  caramel: "caramel",
  coconut: "coconut-milk",
  coconut_milk: "coconut-milk",
  coconut_oil: null,
  watermelon: "watermelon",
  pomegranate: "pomegranate",
  fig: "fig",
  cherry: "cherry",
  strawberry: "strawberry",
  blueberry: "blueberry",
  raspberry: "raspberry",
  peach: "peach",
  mango: "mango",
  avocado: "avocado",
  pear: "pear",
  apple: "apple",
  lemon: "lemon",
  lime: "lime",
  orange: "orange",
  raisin: "raisin",
  rhubarb: "rhubarb",
  fennel: "fennel",
  arugula: "arugula",
  cucumber: "cucumber",
  beet: "beet",
  zucchini: "zucchini",
  eggplant: "eggplant",
  artichoke: "artichoke",
  asparagus: "asparagus",
  broccoli: "broccoli",
  cauliflower: "cauliflower",
  spinach: "spinach",
  mushroom: "mushroom",
  morel: "morel",
  shiitake: "mushroom",
  truffle: null,
  potato: "potato",
  carrot: "carrot",
  onion: "onion",
  shallot: "shallot",
  garlic: "garlic",
  leek: "leek",
  lemongrass: "lemongrass",
  ginger: "ginger",
  turmeric: "turmeric",
  cardamom: "cardamom",
  cinnamon: "cinnamon",
  clove: null, // not in our catalog
  nutmeg: "nutmeg",
  saffron: "saffron",
  paprika: "paprika",
  cumin: "cumin",
  coriander: "coriander",
  cilantro: "cilantro",
  chili: "chili",
  pepper: "black-pepper",
  basil: "basil",
  thyme: "thyme",
  rosemary: "rosemary",
  parsley: "parsley",
  oregano: "oregano",
  mint: "mint",
  sage: "sage",
  dill: "dill",
  tarragon: "tarragon",
  chive: "chive",
  rose: "rose",
  beef: "beef",
  pork: "pork",
  chicken: "chicken",
  lamb: "lamb",
  duck: "duck",
  salmon: "salmon",
  shrimp: "shrimp",
  scallop: "scallop",
  bacon: "bacon",
  almond: "almond",
  walnut: "walnut",
  pecan: "pecan",
  hazelnut: "hazelnut",
  pistachio: "pistachio",
  rice: "rice",
  pasta: "pasta",
  bread: "bread",
  polenta: "polenta",
  chickpea: "chickpea",
  lentil: "lentil",
  tomato: "tomato",
  corn: "corn",
  butter: "butter",
  cream: "cream",
  yogurt: "yogurt",
  milk: "milk",
  parmesan: "parmesan",
  mozzarella: "mozzarella",
  feta: "feta",
  cheddar: "cheddar",
  ricotta: "ricotta",
  burrata: "burrata",
  capers: "capers",
  anchovy: "anchovy",
  olive: "olive",
  chocolate: "chocolate",
  coffee: "coffee",
  mustard: "mustard",
  horseradish: "horseradish",
  harissa: "harissa",
  melon: "melon",
};

function ahnNameToSlug(name) {
  if (!name) return null;
  const key = name.toLowerCase();
  if (key in MANUAL) return MANUAL[key];
  // Try our nameToSlug with snake-to-kebab + space variants
  const kebab = key.replace(/_/g, "-");
  if (knownSlugs.has(kebab)) return kebab;
  const spaced = key.replace(/_/g, " ");
  if (nameToSlug.has(spaced)) return nameToSlug.get(spaced);
  if (nameToSlug.has(key)) return nameToSlug.get(key);
  return null;
}

// --- parse ---
console.log("Reading TSVs from", AHN);
const ingrInfo = readTsv("ingr_info.tsv"); // [id, name, category]
const compInfo = readTsv("comp_info.tsv"); // [id, name, cas]
const ingrComp = readTsv("ingr_comp.tsv"); // [ingrId, compId]

// Build ingredient id → slug (only those we recognize)
const idToSlug = new Map();
let mapped = 0;
let unmapped = [];
for (const [id, name] of ingrInfo) {
  const slug = ahnNameToSlug(name);
  if (slug && knownSlugs.has(slug)) {
    idToSlug.set(id, slug);
    mapped++;
  } else {
    unmapped.push(name);
  }
}
console.log(`Mapped ${mapped}/${ingrInfo.length} Ahn ingredients to our slugs`);

// Build slug → set of compound IDs
const compoundsBySlug = new Map();
const usedCompoundIds = new Set();
for (const [ingrId, compId] of ingrComp) {
  const slug = idToSlug.get(ingrId);
  if (!slug) continue;
  if (!compoundsBySlug.has(slug)) compoundsBySlug.set(slug, new Set());
  compoundsBySlug.get(slug).add(compId);
  usedCompoundIds.add(compId);
}

// Build compound id → name (only ones referenced by our subset)
const compoundNames = {};
for (const [id, name] of compInfo) {
  if (usedCompoundIds.has(id)) compoundNames[id] = name;
}

// Multiple Ahn names can map to the same slug (e.g. wine, white_wine, red_wine
// → wine-red). Merge: union of compound sets per slug.
const byIngredient = {};
for (const [slug, set] of compoundsBySlug) {
  byIngredient[slug] = [...set].map(Number).sort((a, b) => a - b);
}

console.log(`${Object.keys(byIngredient).length} of our ingredients have compound profiles`);
const counts = Object.values(byIngredient).map((c) => c.length);
counts.sort((a, b) => a - b);
const median = counts[Math.floor(counts.length / 2)];
console.log(`Compounds per ingredient — median: ${median}, max: ${counts[counts.length - 1]}, min: ${counts[0]}`);

const output = {
  $schema_version: 1,
  source: "Ahn et al. 2011, 'Flavor network and the principles of food pairing', Scientific Reports.",
  notes:
    "Slimmed down to ingredients in this catalog. Compound IDs are arbitrary identifiers internal to this dataset. Use sharedCompounds(slugA, slugB) for pair similarity.",
  compounds: compoundNames,
  byIngredient,
};

const outPath = path.join(root, "data", "compound-data.json");
fs.writeFileSync(outPath, JSON.stringify(output));
const size = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`Wrote ${outPath} (${size} KB)`);

// Stats: which of our ingredients are MISSING compound profiles?
const slugsWithCompounds = new Set(Object.keys(byIngredient));
const missing = [...knownSlugs].filter((s) => !slugsWithCompounds.has(s));
if (missing.length) {
  console.log(`\n${missing.length} of our ingredients have no compound profile (likely category mismatch):`);
  console.log(`  ${missing.slice(0, 30).join(", ")}${missing.length > 30 ? "…" : ""}`);
}
