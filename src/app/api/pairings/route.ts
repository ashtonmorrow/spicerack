import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";

// GET /api/pairings?slugs=apple,cinnamon
export async function GET(req: NextRequest) {
  const repo = getRepository();
  const raw = req.nextUrl.searchParams.get("slugs") ?? "";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 24);

  const slugs = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (slugs.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const results = await repo.pairingsFor(slugs, limit);
  return NextResponse.json({ results });
}
