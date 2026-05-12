import { NextRequest, NextResponse } from "next/server";
import { matchRecipes } from "@/lib/recipes";

// GET /api/recipes?slugs=apple,butter,cheddar&limit=12&min=2
//
// `min` overrides the size-aware minimum-matched threshold (used by the
// alternate-directions flow to widen the pool past the strict default).
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("slugs") ?? "";
  const limit = Math.min(30, Number(req.nextUrl.searchParams.get("limit") ?? 12));
  const minParam = req.nextUrl.searchParams.get("min");
  const minMatched = minParam ? Number(minParam) : undefined;

  const slugs = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (slugs.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const results = matchRecipes(
    slugs,
    limit,
    minMatched != null ? { minMatched } : undefined
  );
  return NextResponse.json({ results });
}
