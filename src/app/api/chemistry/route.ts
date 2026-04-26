import { NextRequest, NextResponse } from "next/server";
import { chemistryPairingsFor } from "@/lib/compounds";
import { getRepository } from "@/lib/repository";

// GET /api/chemistry?slugs=tomato,basil&limit=8
//
// Returns ingredients sharing the most flavor compounds with the selection.
// The ingredient catalog itself provides the candidate pool — anything in our
// known ingredients is a candidate.
export async function GET(req: NextRequest) {
  const repo = getRepository();
  const raw = req.nextUrl.searchParams.get("slugs") ?? "";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 8);

  const slugs = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (slugs.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const allIngredients = await repo.list();
  const candidates = allIngredients.map((i) => i.slug);
  const matches = chemistryPairingsFor(slugs, candidates, limit);

  // Enrich with ingredient summary for the UI to render chips
  const slugToSummary = new Map(
    allIngredients.map((i) => [i.slug, i])
  );
  const results = matches.map((m) => ({
    ingredient: slugToSummary.get(m.slug) ?? {
      slug: m.slug,
      name: m.slug,
      category: "pantry",
    },
    meanShared: m.meanShared,
    meanSimilarity: m.meanSimilarity,
  }));

  return NextResponse.json({ results });
}
