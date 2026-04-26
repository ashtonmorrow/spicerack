# Flavor Pear

(repo: `spicerack`) — Type an ingredient, get pairings. Add another, get the intersection. The dropdown always has a suggestion for you, so chaining 4-5 ingredients takes seconds.

## Quick demo (no install)

Open `preview.html` in a browser — it's self-contained, no server needed. Same data as the real app, all logic runs in the page.

## Run the real app

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind for styling
- Static JSON data behind a `Repository` interface so we can swap in Postgres / SQLite / a remote API later without touching the UI

## Project layout

```
data/
  ingredients.json          ← seed data (139 ingredients, 942 pairings)
src/
  app/
    page.tsx                ← search + selected chips + pairings panel
    api/
      ingredients/route.ts  ← GET /api/ingredients?q=
      pairings/route.ts     ← GET /api/pairings?slugs=apple,pork
  components/
    IngredientSearch.tsx    ← smart type-ahead: starters → pairings → search
    SelectedChips.tsx       ← removable chips for the current selection
    PairingsPanel.tsx       ← grouped, filterable pairings with affinity dots
    PearLogo.tsx            ← outline-only green pear (uses currentColor)
  lib/
    types.ts                ← shared domain types
    repository.ts           ← Repository interface + singleton accessor
    json-repository.ts      ← JSON-backed implementation (today)
scripts/
  build-preview.mjs         ← bundles the JSON into preview.html
  validate.mjs              ← integrity check on the seed data
```

## How pairings are scored

For a single ingredient, the panel shows everything that ingredient links to, ordered by `strength` (1=good, 2=great, 3=classic).

For multiple ingredients, each candidate's score is `sum(strengths) × (1 + 0.5 × (hits - 1))` where `hits` is how many of your selected ingredients link to it. So a candidate that pairs with all your selections beats one that's strongly linked to only one. The chip shows three dots for affinity and a `×N` badge when a candidate is hit by more than one selection.

## How to add or correct a pairing

Edit `data/ingredients.json`. The shape is:

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

Then validate:

```bash
npm run validate
```

It flags duplicate slugs, dangling pairing references, orphans, and one-way pairings (informational — pairings are intentionally directional unless you mirror them).

To rebuild the standalone preview after data changes:

```bash
npm run preview
```

## Roadmap

**Near term**
- Cuisine inference from selected ingredients (already have `cuisines` on each)
- Seasonal weighting (highlight in-season suggestions)
- "What can I make?" → recipe-shape suggestions from the current selection
- Bring back the Notion sync from the previous iteration as an optional export path

**Data growth**
- Import an open dataset (e.g. ingredient–compound co-occurrence from the Ahn et al. 2011 flavor network paper) to expand beyond hand-curated pairings
- User-added pairings: a write path against the same `Repository` interface

**When the dataset outgrows JSON**
The `IngredientRepository` interface is the only thing the rest of the app talks to. To migrate:

1. Add `src/lib/postgres-repository.ts` implementing `IngredientRepository`.
2. Switch `getRepository()` in `src/lib/repository.ts` to return it.
3. (Optional) Migrate `data/ingredients.json` into a `seed.sql` for the new DB.

Caller code (API routes, components) doesn't change.

## Notes

The seed pairings in `data/ingredients.json` are hand-curated from general culinary knowledge — well-known classic combinations like apple+cinnamon or basil+tomato.

`mvp-data.txt` (kept locally, gitignored) is the previous iteration's input file. Do not commit it or use its text as a source for the seed data; the curated pairings in `data/ingredients.json` were authored independently.
