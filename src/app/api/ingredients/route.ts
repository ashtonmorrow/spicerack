import { NextRequest, NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";

// GET /api/ingredients?q=app   → search by prefix/substring
// GET /api/ingredients          → full list (cheap, ~100 rows today)
export async function GET(req: NextRequest) {
  const repo = getRepository();
  const q = req.nextUrl.searchParams.get("q");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 10);

  if (q !== null) {
    const results = await repo.search(q, limit);
    return NextResponse.json({ results });
  }

  const results = await repo.list();
  return NextResponse.json({ results });
}
