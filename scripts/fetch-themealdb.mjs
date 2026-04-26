// Fetches every meal in TheMealDB, maps each one to the Flavor Pear Recipe
// shape, and writes data/recipes-themealdb.json. Run once and commit the
// output — this is a build-time script, not a runtime fetch.
//
// Usage: node scripts/fetch-themealdb.mjs
//
// Source: https://www.themealdb.com/  (free API key "1")

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const API = "https://www.themealdb.com/api/json/v1/1";

// --- Build a name → slug index from our existing ingredient catalog ---
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
  // also accept the slug itself as a name and the slug-with-spaces
  nameToSlug.set(ing.slug, ing.slug);
  nameToSlug.set(ing.slug.replace(/-/g, " "), ing.slug);
}

// Manual mappings for TheMealDB ingredient labels that don't match our names
// directly. Skip = explicitly map to null to indicate "ignore this ingredient"
// rather than failing the whole recipe.
const SKIP = Symbol("skip");
const MANUAL = {
  // common cuts → base protein
  "ground beef": "beef", "minced beef": "beef", "beef brisket": "beef",
  "beef chuck": "beef", "beef sirloin": "beef", "beef stock": "beef",
  "beef shin": "beef", "beef fillet": "beef", "beef ribs": "beef",
  "stewing beef": "beef", "beef mince": "beef",
  "chicken breast": "chicken", "chicken breasts": "chicken",
  "chicken thigh": "chicken", "chicken thighs": "chicken",
  "chicken stock": "chicken", "chicken broth": "chicken",
  "chicken legs": "chicken", "chicken wings": "chicken",
  "skinless chicken": "chicken", "boneless chicken": "chicken",
  "pork chop": "pork", "pork chops": "pork", "pork belly": "pork",
  "pork shoulder": "pork", "pork loin": "pork", "pork tenderloin": "pork",
  "pork mince": "pork", "pork sausages": "pork", "pork ribs": "pork",
  "lamb shoulder": "lamb", "lamb leg": "lamb", "lamb chops": "lamb",
  "ground lamb": "lamb", "lamb mince": "lamb", "minced lamb": "lamb",
  "lamb shanks": "lamb", "lamb stock": "lamb",
  "duck breast": "duck", "duck breasts": "duck", "duck legs": "duck",
  "salmon fillet": "salmon", "salmon fillets": "salmon", "salmon steak": "salmon",
  "smoked salmon": "salmon",
  "prawns": "shrimp", "tiger prawns": "shrimp", "king prawns": "shrimp",
  "raw king prawns": "shrimp", "raw prawns": "shrimp",
  "scallops": "scallop",
  "fish": "fish-white", "white fish": "fish-white",
  "cod": "fish-white", "halibut": "fish-white", "snapper": "fish-white",
  "sole": "fish-white", "flounder": "fish-white", "haddock": "fish-white",
  "tilapia": "fish-white", "pollock": "fish-white", "sea bass": "fish-white",
  "monkfish": "fish-white", "fish stock": "fish-white",
  "pancetta": "bacon", "streaky bacon": "bacon", "smoked bacon": "bacon",
  "back bacon": "bacon",

  // herbs / spices — strip qualifiers
  "fresh basil": "basil", "basil leaves": "basil",
  "fresh thyme": "thyme", "thyme leaves": "thyme", "dried thyme": "thyme",
  "fresh rosemary": "rosemary", "dried rosemary": "rosemary",
  "fresh parsley": "parsley", "flat leaf parsley": "parsley",
  "italian parsley": "parsley", "dried parsley": "parsley",
  "fresh dill": "dill", "dill weed": "dill",
  "fresh sage": "sage", "dried sage": "sage",
  "fresh mint": "mint", "mint leaves": "mint",
  "fresh tarragon": "tarragon",
  "fresh oregano": "oregano", "dried oregano": "oregano",
  "fresh chives": "chive", "chives": "chive",
  "bay leaves": "bay-leaf", "bay leaf": "bay-leaf",
  "fresh coriander": "cilantro", "fresh cilantro": "cilantro",
  "coriander leaves": "cilantro",
  "ground coriander": "coriander", "coriander seeds": "coriander",
  "ground cumin": "cumin", "cumin seeds": "cumin",
  "smoked paprika": "paprika", "sweet paprika": "paprika",
  "hot paprika": "paprika",
  "ground cinnamon": "cinnamon", "cinnamon stick": "cinnamon",
  "cinnamon sticks": "cinnamon",
  "ground nutmeg": "nutmeg", "fresh nutmeg": "nutmeg",
  "ground cardamom": "cardamom", "cardamom pods": "cardamom",
  "vanilla extract": "vanilla", "vanilla bean": "vanilla",
  "vanilla pod": "vanilla", "vanilla essence": "vanilla",
  "chili powder": "chili", "chilli powder": "chili",
  "chili flakes": "chili", "chilli flakes": "chili",
  "red pepper flakes": "chili", "fresh chili": "chili",
  "fresh chilli": "chili", "red chili": "chili", "red chilli": "chili",
  "green chili": "chili", "green chilli": "chili",
  "jalapeno": "chili", "jalapenos": "chili", "jalapeño": "chili",
  "cayenne pepper": "chili",
  "ground turmeric": "turmeric",
  "saffron threads": "saffron",
  "fresh ginger": "ginger", "ginger root": "ginger",
  "ground ginger": "ginger", "ginger paste": "ginger",
  "anchovies": "anchovy", "anchovy fillets": "anchovy",
  "5 spice": "five-spice", "five spice": "five-spice",
  "five-spice": "five-spice", "chinese five spice": "five-spice",
  "star anise": "anise", "anise seeds": "anise", "aniseed": "anise",
  "rose water": "rose",

  // alliums
  "onions": "onion", "red onion": "onion", "white onion": "onion",
  "yellow onion": "onion", "sweet onion": "onion",
  "garlic clove": "garlic", "garlic cloves": "garlic",
  "fresh garlic": "garlic", "garlic powder": "garlic",
  "minced garlic": "garlic",
  "scallions": "scallion", "spring onion": "scallion",
  "spring onions": "scallion", "green onions": "scallion",
  "shallots": "shallot",
  "leeks": "leek",

  // produce
  "tomatoes": "tomato", "cherry tomatoes": "tomato",
  "plum tomatoes": "tomato", "tomato paste": "tomato",
  "tomato puree": "tomato", "tomato passata": "tomato",
  "diced tomatoes": "tomato", "chopped tomatoes": "tomato",
  "canned tomatoes": "tomato", "crushed tomatoes": "tomato",
  "carrots": "carrot",
  "potatoes": "potato", "new potatoes": "potato",
  "baby potatoes": "potato",
  "sweet potatoes": "sweet-potato", "yams": "sweet-potato",
  "butternut squash": "butternut-squash", "winter squash": "butternut-squash",
  "pumpkin": "butternut-squash",
  "mushrooms": "mushroom", "white mushrooms": "mushroom",
  "cremini mushrooms": "mushroom", "portobello mushrooms": "mushroom",
  "shiitake mushrooms": "mushroom", "porcini mushrooms": "mushroom",
  "chestnut mushrooms": "mushroom", "button mushrooms": "mushroom",
  "morel mushrooms": "morel", "morels": "morel",
  "baby spinach": "spinach", "frozen spinach": "spinach",
  "kale": "spinach", // we don't have kale; closest greens
  "courgette": "zucchini", "courgettes": "zucchini",
  "aubergine": "eggplant",
  "rocket": "arugula",
  "cucumbers": "cucumber",
  "beetroot": "beet", "beets": "beet",
  "fennel bulb": "fennel", "fennel seeds": "fennel",
  "frozen peas": "pea", "fresh peas": "pea", "peas": "pea",
  "artichokes": "artichoke", "artichoke hearts": "artichoke",
  "brussels sprouts": "brussels-sprout",
  "sweet corn": "corn",
  "cherries": "cherry", "dried cherries": "cherry",
  "strawberries": "strawberry",
  "raspberries": "raspberry",
  "blueberries": "blueberry",
  "peaches": "peach",
  "mangoes": "mango", "mango chutney": "mango",
  "avocados": "avocado",
  "pears": "pear",
  "apples": "apple", "granny smith apples": "apple",
  "lemons": "lemon", "lemon juice": "lemon", "lemon zest": "lemon",
  "limes": "lime", "lime juice": "lime", "lime zest": "lime",
  "oranges": "orange", "orange juice": "orange", "orange zest": "orange",
  "figs": "fig", "dried figs": "fig",
  "raisins": "raisin", "sultanas": "raisin", "currants": "raisin",
  "olives": "olive", "kalamata olives": "olive",
  "black olives": "olive", "green olives": "olive",
  "honeydew": "melon", "cantaloupe": "melon",
  "pomegranate seeds": "pomegranate",
  "pomegranate juice": "pomegranate",
  "lemongrass": "lemongrass",

  // dairy
  "unsalted butter": "butter", "salted butter": "butter",
  "heavy cream": "cream", "double cream": "cream",
  "single cream": "cream", "whipping cream": "cream",
  "whole milk": "milk", "semi-skimmed milk": "milk",
  "skimmed milk": "milk",
  "greek yogurt": "yogurt", "natural yogurt": "yogurt",
  "yoghurt": "yogurt", "plain yogurt": "yogurt",
  "parmesan cheese": "parmesan", "parmigiano": "parmesan",
  "parmigiano-reggiano": "parmesan", "grated parmesan": "parmesan",
  "cheddar cheese": "cheddar", "sharp cheddar": "cheddar",
  "mature cheddar": "cheddar",
  "feta cheese": "feta",
  "mozzarella cheese": "mozzarella", "fresh mozzarella": "mozzarella",
  "stilton": "blue-cheese", "gorgonzola": "blue-cheese",
  "roquefort": "blue-cheese", "blue cheese": "blue-cheese",
  "goat cheese": "goat-cheese",
  "ricotta cheese": "ricotta",
  "gruyere cheese": "gruyere", "gruyère": "gruyere",
  "burrata cheese": "burrata",

  // pantry / oils / vinegars
  "extra virgin olive oil": "olive-oil", "evoo": "olive-oil",
  "white wine": "wine-white", "dry white wine": "wine-white",
  "red wine": "wine-red", "dry red wine": "wine-red",
  "rice vinegar": "vinegar-rice", "rice wine vinegar": "vinegar-rice",
  "white wine vinegar": "vinegar-red-wine", // approximation
  "red wine vinegar": "vinegar-red-wine",
  "balsamic vinegar": "balsamic-vinegar",
  "soy sauce": "soy-sauce", "light soy sauce": "soy-sauce",
  "dark soy sauce": "soy-sauce", "tamari": "soy-sauce",
  "fish sauce": "fish-sauce", "nam pla": "fish-sauce",
  "sesame oil": "sesame-oil", "toasted sesame oil": "sesame-oil",
  "tahini paste": "tahini",
  "miso paste": "miso", "white miso": "miso", "red miso": "miso",
  "maple syrup": "maple-syrup",
  "dijon mustard": "mustard", "wholegrain mustard": "mustard",
  "english mustard": "mustard", "yellow mustard": "mustard",
  "honey mustard": "mustard",
  "coconut milk": "coconut-milk", "coconut cream": "coconut-milk",
  "anchovies": "anchovy",
  "capers": "capers", "caper berries": "capers",
  "pine nuts": "pine-nut", "pinenuts": "pine-nut",
  "walnuts": "walnut",
  "almonds": "almond", "almond flour": "almond",
  "ground almonds": "almond", "flaked almonds": "almond",
  "pecans": "pecan",
  "hazelnuts": "hazelnut",
  "pistachios": "pistachio",
  "chickpeas": "chickpea", "garbanzo beans": "chickpea",
  "lentils": "lentil", "red lentils": "lentil", "green lentils": "lentil",
  "white beans": "bean-white", "cannellini beans": "bean-white",
  "navy beans": "bean-white", "haricot beans": "bean-white",
  "horseradish": "horseradish",
  "harissa paste": "harissa", "harissa": "harissa",
  "ground black pepper": "black-pepper",
  "freshly ground pepper": "black-pepper",
  "black peppercorns": "black-pepper",
  "pepper": "black-pepper",
  "white pepper": "black-pepper",
  "eggs": "egg", "egg yolks": "egg", "egg yolk": "egg",
  "egg whites": "egg", "egg white": "egg",
  "red onions": "onion",
  "challots": "shallot", "echalion shallots": "shallot",
  "sirloin steak": "beef", "rib eye": "beef", "rib eye steak": "beef",
  "skirt steak": "beef", "flank steak": "beef",
  "sesame seed oil": "sesame-oil", "sesame seeds": "sesame-oil",
  "kale": "spinach", "swiss chard": "spinach", "chard": "spinach",
  "frozen spinach": "spinach",
  "sea bream": "fish-white", "trout": "fish-white",
  "swordfish": "fish-white",
  "ginger": "ginger",
  "chocolate": "chocolate", "dark chocolate": "chocolate",
  "milk chocolate": "chocolate", "white chocolate": "chocolate",
  "cocoa powder": "chocolate", "chocolate chips": "chocolate",
  "espresso": "coffee", "instant coffee": "coffee",
  "coffee granules": "coffee",
  "caramel sauce": "caramel",
  "brown sugar": "sugar", "white sugar": "sugar",
  "granulated sugar": "sugar", "powdered sugar": "sugar",
  "icing sugar": "sugar", "caster sugar": "sugar",
  "demerara sugar": "sugar", "sugar": "sugar",
  "whiskey": "bourbon", "whisky": "bourbon",

  // grains / starches
  "long grain rice": "rice", "basmati rice": "rice",
  "jasmine rice": "rice", "arborio rice": "rice",
  "wild rice": "rice", "brown rice": "rice", "white rice": "rice",
  "spaghetti": "pasta", "linguine": "pasta", "fettuccine": "pasta",
  "tagliatelle": "pasta", "penne": "pasta", "rigatoni": "pasta",
  "fusilli": "pasta", "macaroni": "pasta", "lasagne sheets": "pasta",
  "ravioli": "pasta", "tortellini": "pasta", "noodles": "pasta",
  "egg noodles": "pasta", "rice noodles": "pasta",
  "soba noodles": "pasta", "udon noodles": "pasta",
  "vermicelli": "pasta",
  "white bread": "bread", "sourdough": "bread",
  "ciabatta": "bread", "baguette": "bread", "naan": "bread",
  "tortillas": "bread", "tortilla": "bread", "pita bread": "bread",
  "flat bread": "bread",
  "cornmeal": "polenta",

  // skip these — not in our slug system and not worth adding:
  "celery": SKIP, "celery stalk": SKIP, "celery stalks": SKIP,
  "bell pepper": SKIP, "bell peppers": SKIP, "red bell pepper": SKIP,
  "green bell pepper": SKIP, "yellow bell pepper": SKIP,
  "red pepper": SKIP, "green pepper": SKIP, "yellow pepper": SKIP,
  "salt": SKIP, "sea salt": SKIP, "kosher salt": SKIP, "table salt": SKIP,
  "water": SKIP, "ice": SKIP, "ice cubes": SKIP,
  "flour": SKIP, "plain flour": SKIP, "all-purpose flour": SKIP,
  "self-raising flour": SKIP, "self raising flour": SKIP,
  "bread flour": SKIP, "cake flour": SKIP, "wheat flour": SKIP,
  "cornstarch": SKIP, "corn starch": SKIP, "cornflour": SKIP,
  "vegetable oil": SKIP, "sunflower oil": SKIP, "canola oil": SKIP,
  "rapeseed oil": SKIP, "oil": SKIP, "frying oil": SKIP,
  "baking powder": SKIP, "baking soda": SKIP,
  "yeast": SKIP, "dried yeast": SKIP, "active dry yeast": SKIP,
  "vegetable stock": SKIP, "vegetable broth": SKIP,
  "stock cubes": SKIP, "stock cube": SKIP,
  "lemon": "lemon", "lime": "lime", "orange": "orange",
  "rum": SKIP, "vodka": SKIP, "gin": SKIP, "brandy": SKIP,
  "beer": SKIP, "ale": SKIP, "stout": SKIP, "champagne": SKIP,
  "vinegar": SKIP, "white vinegar": SKIP, "malt vinegar": SKIP,
  "cider vinegar": SKIP, "apple cider vinegar": SKIP,
  "worcestershire sauce": SKIP, "tabasco sauce": SKIP,
  "ketchup": SKIP, "mayonnaise": SKIP, "hot sauce": SKIP,
  "sriracha": SKIP, "barbecue sauce": SKIP,
  "olive oil": "olive-oil",
  "lemon juice": "lemon", "lime juice": "lime",
  "raisins": "raisin",
};

function normalizeIngredient(raw) {
  if (!raw) return null;
  const cleaned = raw.toLowerCase().trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  // strip parenthetical bits e.g. "tomatoes (canned)"
  const stripped = cleaned.replace(/\(.*?\)/g, "").trim();

  function tryLookup(key) {
    if (key in MANUAL) return MANUAL[key]; // may be SKIP symbol
    if (nameToSlug.has(key)) return nameToSlug.get(key);
    return undefined;
  }

  let r = tryLookup(stripped);
  if (r !== undefined) return r;

  // strip leading qualifiers
  const noQual = stripped.replace(
    /^(fresh|dried|ground|chopped|diced|sliced|minced|grated|crushed|finely chopped|halved|whole|small|large|medium|baby|raw|cooked|frozen|canned|tinned) /,
    ""
  ).trim();
  r = tryLookup(noQual);
  if (r !== undefined) return r;

  // strip trailing common suffixes
  const noSuffix = noQual.replace(
    / (powder|sauce|paste|seeds|leaves|essence|extract|root|cubes|cube)$/,
    ""
  ).trim();
  r = tryLookup(noSuffix);
  if (r !== undefined) return r;

  return null; // truly unknown
}

function mapCourse(category) {
  if (!category) return undefined;
  const lc = category.toLowerCase();
  if (lc.includes("dessert")) return "dessert";
  if (lc.includes("starter")) return "starter";
  if (lc.includes("side")) return "side";
  if (lc.includes("breakfast")) return "main";
  return "main";
}

function mapCuisine(area) {
  if (!area) return undefined;
  const lc = area.toLowerCase();
  if (lc === "unknown") return undefined;
  return lc;
}

function makeAbout(meal, mappedSlugs) {
  // Generic factual one-liner; never copy the original instructions.
  const cuisine = mapCuisine(meal.strArea);
  const cat = (meal.strCategory || "").toLowerCase();
  const cuisinePart = cuisine ? `${cuisine[0].toUpperCase()}${cuisine.slice(1)} ` : "";
  const catPart = cat
    ? cat.endsWith("s") ? cat.slice(0, -1) : cat
    : "dish";
  return `${cuisinePart}${catPart} from TheMealDB.`.replace(/^ /, "");
}

async function fetchJson(url, retries = 3) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} → ${res.status}`);
      const data = await res.json();
      return data;
    } catch (e) {
      lastErr = e;
      // Backoff and retry on transient errors
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function main() {
  console.log("Fetching categories…");
  const cats = await fetchJson(`${API}/categories.php`);
  const categories = cats.categories.map((c) => c.strCategory);

  const allMealIds = new Set();
  for (const cat of categories) {
    process.stdout.write(`  · ${cat} `);
    const list = await fetchJson(
      `${API}/filter.php?c=${encodeURIComponent(cat)}`
    );
    if (list.meals) {
      for (const m of list.meals) allMealIds.add(m.idMeal);
      console.log(`(+${list.meals.length})`);
    } else {
      console.log("(0)");
    }
  }
  console.log(`\n${allMealIds.size} unique meal ids`);

  console.log("Looking up each meal in concurrent batches…");
  const meals = [];
  const ids = [...allMealIds];
  const CONCURRENCY = 15;
  let failCount = 0;
  for (let start = 0; start < ids.length; start += CONCURRENCY) {
    const batch = ids.slice(start, start + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((id) => fetchJson(`${API}/lookup.php?i=${id}`))
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.meals && r.value.meals[0]) {
        meals.push(r.value.meals[0]);
      } else {
        failCount++;
      }
    }
    if ((start + CONCURRENCY) % 60 === 0 || start + CONCURRENCY >= ids.length) {
      console.log(`  · ${Math.min(start + CONCURRENCY, ids.length)}/${ids.length} (kept ${meals.length}, failed ${failCount})`);
    }
  }
  console.log(`Looked up ${meals.length} full meals (${failCount} failed)`);

  console.log("Mapping to Recipe shape…");
  const recipes = [];
  const stats = { kept: 0, dropped: 0, totalSlugsMapped: 0, unmapped: new Map() };
  for (const meal of meals) {
    const slugs = [];
    for (let n = 1; n <= 20; n++) {
      const raw = meal[`strIngredient${n}`];
      if (!raw || !raw.trim()) continue;
      const r = normalizeIngredient(raw);
      if (r === SKIP) continue;
      if (r === null) {
        const k = raw.toLowerCase().trim();
        stats.unmapped.set(k, (stats.unmapped.get(k) ?? 0) + 1);
        continue;
      }
      if (knownSlugs.has(r)) slugs.push(r);
    }
    const unique = [...new Set(slugs)];
    if (unique.length < 3) {
      stats.dropped++;
      continue;
    }
    stats.kept++;
    stats.totalSlugsMapped += unique.length;

    recipes.push({
      id: `mdb-${meal.idMeal}`,
      name: meal.strMeal,
      about: makeAbout(meal, unique),
      cuisine: mapCuisine(meal.strArea),
      course: mapCourse(meal.strCategory),
      required: unique.slice(0, 8),
      optional: [],
      source: "themealdb",
      sourceUrl: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
      // intentionally no `method` — link out to the source for full cooking text
    });
  }

  recipes.sort((a, b) => a.id.localeCompare(b.id));

  console.log(`Kept ${stats.kept}, dropped ${stats.dropped} (too few mapped ingredients)`);
  console.log(`Avg mapped slugs per kept recipe: ${(stats.totalSlugsMapped / stats.kept).toFixed(1)}`);

  // Top 10 unmapped to give a hint about manual-mapping additions
  const topUnmapped = [...stats.unmapped.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  console.log("\nTop unmapped TheMealDB ingredient labels (consider adding to MANUAL):");
  for (const [name, count] of topUnmapped) console.log(`  ${count.toString().padStart(4)}× ${name}`);

  const output = {
    $schema_version: 1,
    source: "TheMealDB (https://www.themealdb.com/) — community-contributed recipes",
    fetched_at: new Date().toISOString(),
    notes:
      "Auto-imported from TheMealDB and ingredient-mapped to Flavor Pear's slug system. The 'about' field is a generic factual one-liner; for the actual cooking method, the recipe's sourceUrl links back to the original page on TheMealDB.",
    recipes,
  };

  const out = path.join(root, "data", "recipes-themealdb.json");
  fs.writeFileSync(out, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${out} (${recipes.length} recipes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
