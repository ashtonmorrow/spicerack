# Flavor Pare

(repo: `spicerack`) — Type ingredients. Get the dish directions hiding inside your selection, plus pairings and recipes for each. Pare down what you have to figure out what to cook.

Live: [pear.mike-lee.me](https://pear.mike-lee.me)

## Quick demo (no install)

Open `preview.html` in a browser — it's self-contained, all data + logic baked in. Same UX as the deployed app.

## Run the app

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## What it does

1. **Type-ahead search** with always-populated dropdowns: empty input shows curated starters, with a selection it shows top pairings, with a query it shows search results.
2. **Cluster analysis** decomposes your selection into "directions" — e.g. apple + cinnamon + butter + pork + sage splits into a sweet/baking direction and a savory pork direction. Click a cluster to filter pairings and recipes to just that subset. Each cluster gets a colored accent that also underlines the chips in that cluster.
3. **Pairings panel** ranks "what else goes with this" by category, with a separate chemistry section using shared flavor compounds from Ahn et al. 2011.
4. **Recipes panel** matches your selection against 262 recipes (34 hand-curated + 228 from TheMealDB), filterable by cuisine and course, with pantry-only mode for "what can I cook *right now*".
5. **Alternate directions** surfaces recipes you're partway to — e.g. shrimp + chili + onion are already pointing at a Thai recipe set; one more ingredient gets you there.
6. **Outlier flagging** points out ingredients that don't fit any current direction and suggests anchor ingredients to fold them in. When curated pairings are thin (caramel, harissa), it falls back to high shared-compound candidates.
7. **Save + pin** combos and recipes locally (no accounts). Saved items live in `localStorage`.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind for styling
- Static JSON data behind a `Repository` interface so the storage can swap to Postgres / SQLite / remote API without touching the UI
- Dynamic OG image via `next/og` with Twemoji food emoji
- Static recipe detail pages (`/recipes/[id]`) with full Recipe JSON-LD schema

## Project layout

```
data/
  ingredients.json          ← 139 ingredients, 942 hand-curated pairings,
                              86 with cuisine tags
  recipes.json              ← 34 hand-curated recipes
  recipes-themealdb.json    ← 228 imported from TheMealDB
  compound-data.json        ← Ahn et al. flavor compound dataset (subset
                              to our catalog: 109 ingredients × 1107 compounds)
src/
  app/
    page.tsx                ← main UI: search, chips, clusters, pairings, recipes
    recipes/[id]/page.tsx   ← static recipe detail page with JSON-LD
    combos/[id]/page.tsx    ← client-side combo detail page
    privacy/page.tsx        ← privacy policy
    opengraph-image.tsx     ← dynamic 1200×630 OG card (Twemoji food scatter)
    api/
      ingredients/route.ts  ← GET /api/ingredients?q=
      pairings/route.ts     ← GET /api/pairings?slugs=apple,pork
      recipes/route.ts      ← GET /api/recipes?slugs=…&limit=…&min=…
      chemistry/route.ts    ← GET /api/chemistry?slugs=…
      anchors/route.ts      ← GET /api/anchors?outliers=…&selection=…
  components/
    IngredientSearch.tsx    ← always-populated dropdown
    SelectedChips.tsx       ← chips with cluster-color underlines + outlier styling
    PairingsPanel.tsx       ← grouped pairings + chemistry section
    RecipesPanel.tsx        ← matched recipes, filterable, with cluster surfacing
    ClusterStrip.tsx        ← "Your selection has N directions" + outliers
    AlternateDirections.tsx ← partway-there recipe surfacing
    QuickStart.tsx          ← empty-state seed combos
    RecipeModal.tsx         ← detail view + Use / Save / Find online actions
    SavedCombos.tsx         ← pinnable bookmark list
    SavedRecipes.tsx        ← parallel for recipes
    MergeBanner.tsx         ← detects + merges duplicate saved items
    Footer.tsx              ← cross-app links + privacy
    PearLetter.tsx          ← inline filled pear used as the "o" in the wordmark
  lib/
    types.ts                ← shared domain types
    clusters.ts             ← ingredient-first multi-signal clustering
    compounds.ts            ← shared-compound similarity
    repository.ts           ← Repository interface + singleton accessor
    json-repository.ts      ← JSON-backed implementation
    combos.ts               ← saved-combo localStorage helpers
    saved-recipes.ts        ← saved-recipe localStorage helpers
    site.ts                 ← canonical URL / identity for metadata
    links.ts                ← cross-app footer links
scripts/
  build-preview.mjs         ← bundles JSON + the page into preview.html
  validate.mjs              ← integrity check on seed data
  test-clusters.mjs         ← behavior tests for the cluster algorithm
  fetch-themealdb.mjs       ← full TheMealDB import (run once, commit output)
  fetch-themealdb-courses.mjs ← targeted re-fetch of Dessert/Starter/Side
  retag-courses.mjs         ← heuristic course re-tag for imported recipes
  tag-cuisines.mjs          ← layer cuisine tags onto ingredients
```

## How clustering works

The cluster algorithm is the brain of the app. It takes your selected ingredients and groups them into coherent "dish directions". Three signals feed a single edge weight per ingredient pair:

```
edge(a, b) =  1.0 × curated_pairing_strength(a, b) / 3      // hand-curated graph
           +  0.6 × shared_compound_jaccard(a, b)            // Ahn et al. chemistry
           +  0.3 × shared_cuisine_overlap(a, b)             // cuisine tags
```

Phase 1 is greedy average-link agglomerative clustering. Phase 2 is a refinement pass where each node can move to a better-fit cluster — this fixes the order-dependent first-merge bias. Phase 3 rescues singletons that have decent affinity to a cluster.

Outliers are detected separately: an ingredient is an outlier iff its strongest edge to any other selected ingredient is below `OUTLIER_THRESHOLD` (0.18). Outliers get anchor suggestions — what to add to fold them into a real direction.

Labels come from the dominant shared property:
- ≥50% share a cuisine → "Italian-leaning"
- ≥60% share a category → "Sweet fruit", "Savory protein", etc.
- Otherwise → "Pear-led" (highest-degree node)

## Scripts

```bash
npm run dev              # local dev server
npm run build            # production build
npm test                 # cluster algorithm tests (17 cases)
npm run typecheck        # tsc --noEmit
npm run validate         # check data integrity
npm run preview          # rebuild preview.html
npm run lint             # next lint
npm run fetch:themealdb           # full re-import (rate-limited)
npm run fetch:themealdb-courses   # targeted: Dessert/Starter/Side/Breakfast
npm run retag:courses             # heuristic course re-tag
```

## Adding ingredients and pairings

Edit `data/ingredients.json`. Shape:

```json
{
  "slug": "apple",
  "name": "Apple",
  "category": "fruit",
  "aliases": ["apples"],
  "seasons": ["fall"],
  "cuisines": ["american", "french"],
  "pairings": [
    { "slug": "cinnamon", "strength": 3 },
    { "slug": "pork",     "strength": 3 }
  ]
}
```

Strength: 1 = good, 2 = great, 3 = classic. Pairings are intentionally directional unless mirrored.

After editing:

```bash
npm run validate    # checks for dangling refs, duplicate slugs, orphans
npm test            # asserts cluster behavior still holds
npm run preview     # rebuild the standalone preview
```

## Migrating off JSON

The `IngredientRepository` interface is the only thing the rest of the app talks to. To switch storage:

1. Add `src/lib/postgres-repository.ts` (or whatever) implementing `IngredientRepository`.
2. Flip `getRepository()` in `src/lib/repository.ts` to return it.
3. Migrate `data/ingredients.json` and the recipe files into seed SQL.

API routes and components don't change.

## Notes

- Curated pairings are hand-authored from general culinary knowledge — no copyrighted source. `mvp-data.txt` (gitignored) is a previous iteration's input file; the curated pairings in `data/ingredients.json` were authored independently.
- TheMealDB-imported recipes link back to their source URL when a user clicks "Find recipe online" so we don't reproduce copyrighted recipe text.
- Flavor compound data is from [Ahn et al. 2011, "Flavor network and the principles of food pairing"](https://www.nature.com/articles/srep00196), public dataset.
- Twemoji food glyphs in the OG image are CC BY 4.0.

## Privacy

No accounts, no analytics, no third-party trackers. Combos and saved recipes live in your browser's `localStorage`. Full policy at [`/privacy`](https://pear.mike-lee.me/privacy).
