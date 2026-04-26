// Bundles data/ingredients.json into a single self-contained preview.html
// so you can double-click to demo the UX without `npm install`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const data = fs.readFileSync(
  path.join(root, "data", "ingredients.json"),
  "utf8"
);
const tmpl = fs.readFileSync(
  path.join(root, "scripts", "preview.template.html"),
  "utf8"
);
const out = tmpl.replace("/*__INGREDIENTS_JSON__*/null", data);
const outPath = path.join(root, "preview.html");
fs.writeFileSync(outPath, out);
console.log("wrote", outPath);
