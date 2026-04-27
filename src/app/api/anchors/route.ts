import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";

// GET /api/anchors?outliers=caramel,bacon,vanilla&selection=apple,butter,...
//
// For each outlier, returns its top bridge-aware anchor candidates: ingredients
// that pair with the outlier AND ideally with other ingredients in the user's
// selection too, so adding them produces a real merge into a coherent direction.
//
// Response shape:
//   { results: { caramel: AnchorSuggestion[], bacon: [...], ... } }
//
// One round-trip for all outliers — caller doesn't need N parallel fetches.
export async function GET(req: NextRequest) {
  const repo = getRepository();
  const outlierParam = req.nextUrl.searchParams.get("outliers") ?? "";
  const selectionParam = req.nextUrl.searchParams.get("selection") ?? "";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 3);

  const outliers = outlierParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const selection = selectionParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (outliers.length === 0) {
    return NextResponse.json({ results: {} });
  }

  const entries = await Promise.all(
    outliers.map(
      async (slug) =>
        [slug, await repo.anchorsFor(slug, selection, limit)] as const
    )
  );

  const results = Object.fromEntries(entries);
  return NextResponse.json({ results });
}
