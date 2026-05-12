// Targeted fetch of only the course-bearing TheMealDB category buckets that
// the initial import missed because of rate-limit attrition: Dessert, Starter,
// Side, Breakfast. Merges results into the existing recipes-themealdb.json
// without disturbing main-course recipes that are already there.
//
// Run: node scripts/fetch-themealdb-courses.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const API = "https://www.themealdb.com/api/json/v1/1";
const TARGET_CATEGORIES = ["Dessert", "Starter", "Side", "Breakfast"];

const seed = JSON.parse(
  fs.readFileSync(path.join(root, "data", "ingredients.json"), "utf8")
);
const knownSlugs = new Set(seed.ingredients.map((i) => i.slug));
const nameToSlug = new Map();
for (const ing of seed.ingredients) {
  nameToSlug.set(ing.name.toLowerCase(), ing.slug);
  for (const alias of ing.aliases ?? []) {
    nameToSlug.set(alias.toLowerCase(), ing.slug);
  }
  nameToSlug.set(ing.slug, ing.slug);
  nameToSlug.set(ing.slug.replace(/-/g, " "), ing.slug);
}

const SKIP = Symbol("skip");
// Reuse the manual mapping table from the main fetcher — duplicated here
// because that script is large and we just want the same normalization.
const MANUAL = {
  "ground beef": "beef", "minced beef": "beef",
  "chicken breast": "chicken", "chicken thighs": "chicken", "chicken stock": "chicken",
  "pork chops": "pork", "pork shoulder": "pork", "pork tenderloin": "pork",
  "salmon fillet": "salmon", "salmon fillets": "salmon",
  "fresh basil": "basil", "fresh thyme": "thyme", "fresh rosemary": "rosemary",
  "fresh parsley": "parsley", "fresh dill": "dill", "fresh mint": "mint",
  "fresh oregano": "oregano", "bay leaves": "bay-leaf", "bay leaf": "bay-leaf",
  "fresh cilantro": "cilantro", "ground cumin": "cumin", "ground coriander": "coriander",
  "smoked paprika": "paprika", "ground cinnamon": "cinnamon", "ground nutmeg": "nutmeg",
  "vanilla extract": "vanilla", "vanilla bean": "vanilla",
  "olive oil": "olive-oil", "extra virgin olive oil": "olive-oil",
  "vegetable oil": "olive-oil",
  "soy sauce": "soy-sauce", "dark soy sauce": "soy-sauce", "light soy sauce": "soy-sauce",
  "sesame oil": "sesame-oil", "rice vinegar": "vinegar", "white wine vinegar": "vinegar",
  "balsamic vinegar": "balsamic", "red wine vinegar": "vinegar",
  "white wine": "wine-white", "red wine": "wine-red", "dry white wine": "wine-white",
  "double cream": "cream", "heavy cream": "cream", "single cream": "cream",
  "whipping cream": "cream", "thickened cream": "cream",
  "self-raising flour": "flour", "self raising flour": "flour",
  "plain flour": "flour", "all-purpose flour": "flour", "all purpose flour": "flour",
  "caster sugar": "sugar", "granulated sugar": "sugar", "icing sugar": "sugar",
  "powdered sugar": "sugar", "brown sugar": "sugar", "white sugar": "sugar",
  "dark brown sugar": "sugar", "light brown sugar": "sugar",
  "salted butter": "butter", "unsalted butter": "butter",
  "egg yolks": "egg", "egg whites": "egg", "egg yolk": "egg", "egg white": "egg",
  "free range eggs": "egg", "large egg": "egg", "large eggs": "egg",
  "kosher salt": SKIP, "salt": SKIP, "sea salt": SKIP, "table salt": SKIP,
  "pepper": "black-pepper", "ground black pepper": "black-pepper",
  "freshly ground black pepper": "black-pepper",
  "water": SKIP, "ice": SKIP, "ice water": SKIP, "boiling water": SKIP,
};

function normalizeIngredient(raw) {
  const k = raw.toLowerCase().trim();
  if (MANUAL[k] === SKIP) return SKIP;
  if (MANUAL[k]) return MANUAL[k];
  if (nameToSlug.has(k)) return nameToSlug.get(k);
  // strip simple qualifiers
  const stripped = k.replace(/^(fresh|dried|ground|chopped|minced|sliced|whole|raw|cooked) /, "");
  if (nameToSlug.has(stripped)) return nameToSlug.get(stripped);
  return null;
}

async function fetchJson(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} → ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
}

function mapCourse(category, name) {
  const lc = (category ?? "").toLowerCase();
  if (lc.includes("dessert")) return "dessert";
  if (lc.includes("starter")) return "starter";
  if (lc.includes("side")) return "side";
  // Breakfast → dessert for sweet things, side for savory; default main.
  if (lc.includes("breakfast")) {
    const n = (name ?? "").toLowerCase();
    if (/\b(pancake|waffle|muffin|scone|french toast|toast|crepe|brioche)\b/.test(n)) {
      return "dessert";
    }
    return "main";
  }
  return "main";
}
function mapCuisine(area) {
  if (!area) return undefined;
  const lc = area.toLowerCase();
  if (lc === "unknown") return undefined;
  return lc;
}

async function main() {
  // Load existing imported recipes so we can merge without duplicating ids.
  const existingPath = path.join(root, "data", "recipes-themealdb.json");
  const existing = JSON.parse(fs.readFileSync(existingPath, "utf8"));
  const existingIds = new Set(existing.recipes.map((r) => r.id));

  const newMealIds = new Set();
  for (const cat of TARGET_CATEGORIES) {
    process.stdout.write(`  · ${cat} `);
    const list = await fetchJson(`${API}/filter.php?c=${encodeURIComponent(cat)}`);
    if (list.meals) {
      for (const m of list.meals) newMealIds.add(m.idMeal);
      console.log(`(+${list.meals.length})`);
    } else {
      console.log("(0)");
    }
  }
  console.log(`${newMealIds.size} candidate meal ids from missing categories`);

  // Skip ids we already have.
  const newIds = [...newMealIds].filter((id) => !existingIds.has(`mdb-${id}`));
  console.log(`${newIds.length} of those are not already imported`);

  // Look up each in concurrent batches.
  const meals = [];
  const CONCURRENCY = 8;
  let fail = 0;
  for (let i = 0; i < newIds.length; i += CONCURRENCY) {
    const batch = newIds.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((id) => fetchJson(`${API}/lookup.php?i=${id}`))
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.meals?.[0]) {
        meals.push(r.value.meals[0]);
      } else {
        fail++;
      }
    }
  }
  console.log(`Looked up ${meals.length} meals (${fail} failed)`);

  // Map to Recipe shape.
  const newRecipes = [];
  for (const meal of meals) {
    const slugs = [];
    for (let n = 1; n <= 20; n++) {
      const raw = meal[`strIngredient${n}`];
      if (!raw || !raw.trim()) continue;
      const r = normalizeIngredient(raw);
      if (r === SKIP || r === null) continue;
      if (knownSlugs.has(r)) slugs.push(r);
    }
    const unique = [...new Set(slugs)];
    if (unique.length < 3) continue;
    const cuisine = mapCuisine(meal.strArea);
    const cat = (meal.strCategory || "").toLowerCase();
    const cuisinePart = cuisine ? `${cuisine[0].toUpperCase()}${cuisine.slice(1)} ` : "";
    const catPart = cat ? (cat.endsWith("s") ? cat.slice(0, -1) : cat) : "dish";
    newRecipes.push({
      id: `mdb-${meal.idMeal}`,
      name: meal.strMeal,
      about: `${cuisinePart}${catPart} from TheMealDB.`.replace(/^ /, ""),
      cuisine,
      course: mapCourse(meal.strCategory, meal.strMeal),
      required: unique.slice(0, 8),
      optional: [],
      source: "themealdb",
      sourceUrl: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
    });
  }

  console.log(`Mapped ${newRecipes.length} new recipes (≥3 known ingredients each)`);

  // Merge.
  existing.recipes.push(...newRecipes);
  existing.fetched_at = new Date().toISOString();
  fs.writeFileSync(existingPath, JSON.stringify(existing, null, 2) + "\n");
  console.log(`Total recipes in file: ${existing.recipes.length}`);

  const tally = {};
  for (const r of existing.recipes) tally[r.course] = (tally[r.course] || 0) + 1;
  console.log("Course distribution:", tally);
}

main().catch((e) => { console.error(e); process.exit(1); });
