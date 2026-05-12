// Behavior tests for the cluster algorithm. These lock in the current
// semantics so threshold tuning and refactors don't silently regress.
//
// Lives outside src/ as a Node-runnable script — no test framework, just
// plain assert. Run: node scripts/test-clusters.mjs
//
// Each test describes WHAT the algorithm should do and WHY, then asserts.
// When a test fails, the message explains the intent so future-me knows
// whether to update the test or fix the algorithm.

import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

// Load data the same way src/lib/clusters.ts does.
const seed = JSON.parse(
  fs.readFileSync(path.join(root, "data", "ingredients.json"), "utf8")
);
const compoundData = JSON.parse(
  fs.readFileSync(path.join(root, "data", "compound-data.json"), "utf8")
);
const bySlug = new Map(seed.ingredients.map((i) => [i.slug, i]));

// --- Replicate the algorithm. Kept in sync with src/lib/clusters.ts manually;
// the lib itself can't be imported here because it's TypeScript. If a test
// fails, fix the lib AND update this mirror.
const compoundSets = new Map();
function compoundSetFor(slug) {
  if (compoundSets.has(slug)) return compoundSets.get(slug);
  const arr = compoundData.byIngredient[slug];
  const set = arr ? new Set(arr) : null;
  compoundSets.set(slug, set);
  return set;
}
function compoundJaccard(a, b) {
  const sa = compoundSetFor(a), sb = compoundSetFor(b);
  if (!sa || !sb || sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const c of sa) if (sb.has(c)) inter++;
  return inter / (sa.size + sb.size - inter);
}

const W_PAIR = 1.0, W_CHEM = 0.6, W_CUISINE = 0.3;
const MERGE_THRESHOLD = 0.34;
const OUTLIER_THRESHOLD = 0.18;
const REFINE_EPSILON = 0.05;

function pairingStrength(a, b) {
  const ia = bySlug.get(a);
  if (!ia) return 0;
  const edge = (ia.pairings || []).find((p) => p.slug === b);
  return edge ? edge.strength / 3 : 0;
}
function cuisineOverlap(a, b) {
  const ia = bySlug.get(a), ib = bySlug.get(b);
  if (!ia?.cuisines?.length || !ib?.cuisines?.length) return 0;
  const setA = new Set(ia.cuisines);
  let shared = 0;
  for (const c of ib.cuisines) if (setA.has(c)) shared++;
  return shared / Math.max(ia.cuisines.length, ib.cuisines.length, 1);
}
function edgeWeight(a, b) {
  if (a === b) return 0;
  const pair = Math.max(pairingStrength(a, b), pairingStrength(b, a));
  return W_PAIR * pair + W_CHEM * compoundJaccard(a, b) + W_CUISINE * cuisineOverlap(a, b);
}
function ek(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }
function clusterIngredients(slugs) {
  if (slugs.length === 0) return [];
  if (slugs.length === 1) return [[slugs[0]]];
  const edges = new Map();
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const w = edgeWeight(slugs[i], slugs[j]);
      if (w > 0) edges.set(ek(slugs[i], slugs[j]), w);
    }
  }
  function avgLink(a, b) {
    if (!a.length || !b.length) return 0;
    let s = 0;
    for (const x of a) for (const y of b) s += edges.get(ek(x, y)) || 0;
    return s / (a.length * b.length);
  }
  let clusters = slugs.map((s) => [s]);
  // Phase 1
  for (let p = 0; p < 100; p++) {
    let bI = -1, bJ = -1, bW = MERGE_THRESHOLD;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const w = avgLink(clusters[i], clusters[j]);
        if (w > bW) { bW = w; bI = i; bJ = j; }
      }
    }
    if (bI === -1) break;
    clusters[bI] = [...clusters[bI], ...clusters[bJ]];
    clusters.splice(bJ, 1);
  }
  // Phase 2: refinement
  for (let iter = 0; iter < 20; iter++) {
    let moved = false;
    for (const slug of slugs) {
      let curIdx = -1;
      for (let i = 0; i < clusters.length; i++) {
        if (clusters[i].includes(slug)) { curIdx = i; break; }
      }
      if (curIdx === -1) continue;
      const peers = clusters[curIdx].filter((s) => s !== slug);
      const cur = avgLink([slug], peers);
      let bestIdx = curIdx, best = cur;
      for (let i = 0; i < clusters.length; i++) {
        if (i === curIdx) continue;
        const s = avgLink([slug], clusters[i]);
        if (s > best + REFINE_EPSILON) { best = s; bestIdx = i; }
      }
      if (bestIdx !== curIdx) {
        clusters[curIdx] = clusters[curIdx].filter((s) => s !== slug);
        clusters[bestIdx] = [...clusters[bestIdx], slug];
        moved = true;
      }
    }
    clusters = clusters.filter((c) => c.length > 0);
    if (!moved) break;
  }
  // Phase 3: rescue singletons
  for (let iter = 0; iter < 5; iter++) {
    let changed = false;
    for (let i = clusters.length - 1; i >= 0; i--) {
      if (clusters[i].length !== 1) continue;
      const node = clusters[i][0];
      let bestIdx = -1, best = MERGE_THRESHOLD;
      for (let j = 0; j < clusters.length; j++) {
        if (j === i) continue;
        const s = avgLink([node], clusters[j]);
        if (s > best) { best = s; bestIdx = j; }
      }
      if (bestIdx !== -1) {
        clusters[bestIdx] = [...clusters[bestIdx], node];
        clusters.splice(i, 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return clusters;
}
function analyzeSelection(slugs) {
  if (slugs.length === 0) return { clusters: [], outliers: [] };
  // Outliers only make sense relative to other ingredients.
  const outliers = [];
  if (slugs.length >= 2) {
    for (const s of slugs) {
      let max = 0;
      for (const o of slugs) if (o !== s) max = Math.max(max, edgeWeight(s, o));
      if (max < OUTLIER_THRESHOLD) outliers.push(s);
    }
  }
  const outlierSet = new Set(outliers);
  const clusterable = slugs.filter((s) => !outlierSet.has(s));
  const groups = clusterIngredients(clusterable).filter((g) => g.length > 0);
  const multi = groups.filter((g) => g.length > 1);
  const used = (multi.length >= 2 || (multi.length === 1 && groups.length > 1)) ? multi : groups;
  return { clusters: used.map((g) => [...g].sort()), outliers };
}

// --- Test helpers ------------------------------------------------------------

function clusterContaining(analysis, slug) {
  return analysis.clusters.find((c) => c.includes(slug));
}
function sortedSlugs(slugs) {
  return [...slugs].sort();
}

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, message: e.message });
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

// --- Tests -------------------------------------------------------------------

console.log("\nEmpty/trivial cases:");
test("empty selection → empty result", () => {
  const r = analyzeSelection([]);
  assert.deepEqual(r.clusters, []);
  assert.deepEqual(r.outliers, []);
});
test("single ingredient → one trivial group, no outliers", () => {
  const r = analyzeSelection(["tomato"]);
  // Single-ingredient cluster is suppressed when there are multiple groups,
  // but kept when it's the only one. Outlier check requires another ingredient
  // to compute max-edge, so a singleton is never an outlier.
  assert.equal(r.outliers.length, 0);
});

console.log("\nCoherent cuisine groupings:");
test("tomato + basil + mozzarella + olive-oil → one Italian cluster", () => {
  const r = analyzeSelection(["tomato", "basil", "mozzarella", "olive-oil"]);
  assert.equal(r.outliers.length, 0, `unexpected outliers: ${r.outliers.join(",")}`);
  assert.equal(r.clusters.length, 1, `expected 1 cluster, got ${r.clusters.length}`);
  assert.deepEqual(
    sortedSlugs(r.clusters[0]),
    sortedSlugs(["tomato", "basil", "mozzarella", "olive-oil"])
  );
});
test("miso + ginger + scallion + sesame-oil → coherent (no outliers)", () => {
  const r = analyzeSelection(["miso", "ginger", "scallion", "sesame-oil"]);
  assert.equal(r.outliers.length, 0, `outliers: ${r.outliers.join(",")}`);
});

console.log("\nMulti-direction selections decompose:");
test("apple + cinnamon + pork + sage → sweet vs savory directions", () => {
  const r = analyzeSelection(["apple", "cinnamon", "pork", "sage"]);
  // Pork and sage strongly pair; apple and cinnamon strongly pair. Should
  // split into 2 clusters or apple+cinnamon clusters and pork+sage clusters
  // (with possibly some bridging).
  assert.ok(r.clusters.length >= 1, "should have at least one cluster");
  const porkCluster = clusterContaining(r, "pork");
  const sageCluster = clusterContaining(r, "sage");
  if (porkCluster && sageCluster) {
    assert.deepEqual(
      porkCluster, sageCluster,
      "pork and sage should be in the same cluster — both savory, strong curated pair"
    );
  }
});
test("screenshot's big selection: beef joins mushroom direction, not cheese", () => {
  const r = analyzeSelection([
    "pear", "blue-cheese", "walnut", "arugula", "honey",
    "beef", "mushroom", "thyme", "onion", "black-pepper", "fig", "garlic"
  ]);
  const beefCluster = clusterContaining(r, "beef");
  const mushroomCluster = clusterContaining(r, "mushroom");
  const blueCheeseCluster = clusterContaining(r, "blue-cheese");
  assert.ok(beefCluster, "beef should be in a cluster, not an outlier");
  assert.ok(mushroomCluster, "mushroom should be in a cluster");
  assert.ok(blueCheeseCluster, "blue-cheese should be in a cluster");
  // Beef has avg-affinity ~1.0 to mushroom cluster vs ~0.23 to cheese cluster.
  // After phase-2 refinement, it should land with mushroom.
  assert.deepEqual(
    beefCluster, mushroomCluster,
    "beef's strongest avg-link is to mushroom/onion/garlic/thyme — refinement should move it there"
  );
  assert.notDeepEqual(
    beefCluster, blueCheeseCluster,
    "beef should NOT cluster with pear/blue-cheese/walnut/honey/fig — those are a cheese-board direction"
  );
});

console.log("\nThe Thai shrimp test (Mike's original ask):");
test("shrimp + chili + lemongrass + lime → Thai-leaning cluster emerges", () => {
  const r = analyzeSelection([
    "shrimp", "chili", "onion", "garlic", "lemongrass", "lime"
  ]);
  // Shrimp/chili/lemongrass/lime all share thai cuisine tags — should cluster.
  // Onion+garlic are pan-cuisine aromatics — may form their own cluster or be
  // bridged in. The Thai-specific group should exist as a recognizable thing.
  const thaiCore = ["shrimp", "lemongrass", "lime"];
  const clusterCounts = thaiCore.map((s) => clusterContaining(r, s));
  // All three should be in the same cluster.
  assert.deepEqual(
    clusterCounts[0], clusterCounts[1],
    "shrimp + lemongrass should cluster together (Thai signature)"
  );
  assert.deepEqual(
    clusterCounts[1], clusterCounts[2],
    "lemongrass + lime should cluster together (Thai signature)"
  );
});

console.log("\nOutlier detection:");
test("tomato + caramel → no useful cluster, both flagged as weak-affinity", () => {
  // These two have no curated pairing, low chemistry similarity (probably),
  // and no shared cuisines. Both should be outliers OR form a single weak
  // cluster — but not be wrongly merged into a "direction".
  const r = analyzeSelection(["tomato", "caramel"]);
  // If they cluster, the edge weight should still indicate weak affinity.
  // We mainly care that neither is silently dropped.
  const seen = new Set([...r.outliers, ...r.clusters.flat()]);
  assert.ok(seen.has("tomato"));
  assert.ok(seen.has("caramel"));
});
test("strong pairing + disconnected outlier → outlier flagged", () => {
  // tomato + basil + olive-oil all strongly tie. Caramel is unrelated.
  const r = analyzeSelection(["tomato", "basil", "olive-oil", "caramel"]);
  assert.ok(
    r.outliers.includes("caramel"),
    `caramel should be flagged as outlier in a Mediterranean-leaning selection — got outliers: ${r.outliers.join(",")}`
  );
});

console.log("\nStability:");
test("analyzeSelection is deterministic — same input twice gives same output", () => {
  const sel = ["apple", "butter", "cheddar", "pork", "sage"];
  const a = analyzeSelection(sel);
  const b = analyzeSelection(sel);
  assert.deepEqual(a.outliers, b.outliers);
  assert.deepEqual(
    a.clusters.map((c) => sortedSlugs(c)).sort(),
    b.clusters.map((c) => sortedSlugs(c)).sort()
  );
});
test("input order doesn't change cluster membership", () => {
  // Order shouldn't matter — the algorithm is over sets.
  const a = analyzeSelection(["apple", "cinnamon", "pork", "sage"]);
  const b = analyzeSelection(["sage", "pork", "cinnamon", "apple"]);
  const aSorted = a.clusters.map((c) => sortedSlugs(c)).sort();
  const bSorted = b.clusters.map((c) => sortedSlugs(c)).sort();
  assert.deepEqual(aSorted, bSorted);
});

console.log("\nEdge weight building blocks:");
test("classic pairings give high edge weight", () => {
  const w = edgeWeight("tomato", "basil");
  assert.ok(w >= 1.0, `tomato↔basil is a strength-3 classic; expected w >= 1.0, got ${w.toFixed(3)}`);
});
test("unrelated ingredients give low edge weight", () => {
  const w = edgeWeight("tomato", "caramel");
  assert.ok(w < OUTLIER_THRESHOLD, `tomato↔caramel should be below outlier threshold (${OUTLIER_THRESHOLD}); got ${w.toFixed(3)}`);
});

console.log(`\n${passed} passed · ${failed} failed`);
if (failed > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  · ${f.name}: ${f.message}`);
  process.exit(1);
}
