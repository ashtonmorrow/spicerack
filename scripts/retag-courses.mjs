// Heuristic course re-tagging for recipes in data/recipes-themealdb.json.
//
// Why: the initial TheMealDB import categorized every recipe as "main" because
// the rate-limited fetch only pulled the Beef/Chicken/Pork/Seafood/Pasta/etc.
// category buckets — Dessert/Starter/Side/Breakfast never came through. This
// script flips recipes to dessert/starter/side based on name patterns where
// the signal is unambiguous. Designed to be idempotent — re-runnable safely.
//
// Run: node scripts/retag-courses.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const target = path.join(root, "data", "recipes-themealdb.json");

const file = JSON.parse(fs.readFileSync(target, "utf8"));

// Pattern lists. Conservative — only words/phrases that strongly imply a
// course on their own. Exclusions handle cases like "shepherd's pie" (savory).
const DESSERT_PATTERNS = [
  /\b(brownie|brownies)\b/i,
  /\b(cake|cakes|cupcake|cupcakes|cheesecake)\b/i,
  /\b(cookie|cookies|biscuit|biscuits)\b/i,
  /\b(tart|tarts|tartlet)\b/i,
  /\b(pudding|trifle|mousse|custard|souffl[eé]|tiramisu|panna cotta|baklava)\b/i,
  /\b(eclair|profiterole|crumble|cobbler|fudge|truffle|sorbet|gelato|ice cream)\b/i,
  /\b(pancake|waffle|muffin|scone|donut|doughnut|crepe)\b/i,
  /\b(pie)\b/i, // qualified below
];
const DESSERT_NEGATIVES = [
  // savory pies / cakes that share keywords but aren't desserts
  /\b(shepherd|cottage|cumberland|chicken|beef|pork|lamb|fish|seafood|vegetable|veg\.?|mince|steak)\b.*\bpie\b/i,
  /\bpie\b.*\b(shepherd|cottage|cumberland|chicken|beef|pork|lamb|fish|seafood|vegetable|veg\.?|mince|steak)\b/i,
  /\b(potato|crab|corn)\b.*\b(cake|cakes)\b/i,
  /\b(cake|cakes)\b.*\b(crab|fish|potato|salmon|tuna|rice)\b/i,
];

const STARTER_PATTERNS = [
  /\b(soup|broth|chowder|bisque|gazpacho|consomm[eé])\b/i,
  /\b(salad)\b/i,
  /\b(appetizer|appetiser|bruschetta|tapenade|crostini|hummus|dip)\b/i,
];
// Salads with grilled/protein-led names are usually mains, not starters.
const STARTER_NEGATIVES = [
  /\b(steak|grilled|seared|roast|roasted|braised|chicken caesar|chicken cobb|nicoise|niçoise)\b/i,
];

const SIDE_PATTERNS = [
  /\b(coleslaw|slaw|cornbread|focaccia|flatbread)\b/i,
  /\bnaan\b/i,
  /\b(french fries|chips and salsa)\b/i,
];
// Any main-protein keyword anywhere in the name disqualifies "side" — those
// are mains that happen to mention a side as garnish.
const SIDE_NEGATIVES = [
  /\b(chicken|beef|pork|lamb|fish|salmon|prawn|shrimp|tuna|steak|tofu|tempeh|lentil|sausage|meatball|burger|kebab|curry|stew|roast|grill|grilled|braised|stuffed)\b/i,
];

const SAUCE_PATTERNS = [
  /\b(sauce|salsa|chutney|relish|aioli|pesto|dressing|vinaigrette)\b/i,
];
const SAUCE_NEGATIVES = [
  // protein-with-sauce mains (and pasta-with-sauce mains)
  /\b(chicken|beef|pork|lamb|fish|salmon|prawn|shrimp|tofu|pasta|noodle|spaghetti|penne|fettuccine|linguine|gnocchi)\b/i,
];

function matchesAny(name, patterns) {
  return patterns.some((re) => re.test(name));
}

function inferCourse(name) {
  if (matchesAny(name, DESSERT_PATTERNS) && !matchesAny(name, DESSERT_NEGATIVES)) {
    return "dessert";
  }
  if (matchesAny(name, STARTER_PATTERNS) && !matchesAny(name, STARTER_NEGATIVES)) {
    return "starter";
  }
  if (matchesAny(name, SAUCE_PATTERNS) && !matchesAny(name, SAUCE_NEGATIVES)) {
    return "sauce";
  }
  if (matchesAny(name, SIDE_PATTERNS) && !matchesAny(name, SIDE_NEGATIVES)) {
    return "side";
  }
  return null;
}

// Only consider re-tagging recipes currently labeled "main". The targeted
// course re-fetch (fetch-themealdb-courses.mjs) already assigned dessert /
// starter / side from TheMealDB's category data — those are authoritative and
// shouldn't be reset by name-pattern heuristics, which are weaker.
let changed = 0;
const tally = { dessert: 0, starter: 0, side: 0, sauce: 0, main: 0 };
const changedList = [];
for (const r of file.recipes) {
  if (r.course !== "main") {
    tally[r.course] = (tally[r.course] || 0) + 1;
    continue;
  }
  const inferred = inferCourse(r.name);
  if (inferred && inferred !== r.course) {
    changedList.push(`${r.name}: ${r.course} → ${inferred}`);
    r.course = inferred;
    changed++;
  }
  tally[r.course] = (tally[r.course] || 0) + 1;
}

fs.writeFileSync(target, JSON.stringify(file, null, 2) + "\n");
console.log(`Re-tagged ${changed} recipes`);
for (const line of changedList) console.log(`  ${line}`);
console.log("\nNew course distribution:");
for (const [k, v] of Object.entries(tally)) console.log(`  ${k}: ${v}`);
