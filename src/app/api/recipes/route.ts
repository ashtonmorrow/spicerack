import { NextRequest, NextResponse } from "next/server";
import { matchRecipes } from "@/lib/recipes";

// GET /api/recipes?slugs=apple,butter,cheddar&limit=4
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("slugs") ?? "";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 4);

  const slugs = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (slugs.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const results = matchRecipes(slugs, limit);
  return NextResponse.json({ results });
}
