// Bundles data/ingredients.json + data/recipes.json + data/recipes-themealdb.json
// into preview.html so you can double-click to demo the UX without `npm install`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const ingredients = fs.readFileSync(
  path.join(root, "data", "ingredients.json"),
  "utf8"
);
const recipesCurated = fs.readFileSync(
  path.join(root, "data", "recipes.json"),
  "utf8"
);
const recipesImportedPath = path.join(root, "data", "recipes-themealdb.json");
const recipesImported = fs.existsSync(recipesImportedPath)
  ? fs.readFileSync(recipesImportedPath, "utf8")
  : '{"recipes":[]}';
const compoundPath = path.join(root, "data", "compound-data.json");
const compounds = fs.existsSync(compoundPath)
  ? fs.readFileSync(compoundPath, "utf8")
  : '{"compounds":{},"byIngredient":{}}';

const tmpl = fs.readFileSync(
  path.join(root, "scripts", "preview.template.html"),
  "utf8"
);
const out = tmpl
  .replace("/*__INGREDIENTS_JSON__*/null", ingredients)
  .replace("/*__RECIPES_JSON__*/null", recipesCurated)
  .replace("/*__RECIPES_IMPORTED_JSON__*/null", recipesImported)
  .replace("/*__COMPOUND_JSON__*/null", compounds);
const outPath = path.join(root, "preview.html");
fs.writeFileSync(outPath, out);

const curatedCount = JSON.parse(recipesCurated).recipes.length;
const importedCount = JSON.parse(recipesImported).recipes?.length ?? 0;
console.log(
  `wrote ${outPath} (${curatedCount} curated + ${importedCount} imported = ${curatedCount + importedCount} recipes)`
);
