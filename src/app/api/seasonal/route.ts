// GET /api/seasonal?season=spring → IngredientSummary[]
// Server-derives the season from the current month if not specified.

import { NextResponse } from "next/server";
import { getRepository, type Season } from "@/lib/repository";

const SEASONS: Season[] = ["spring", "summer", "fall", "winter"];

function currentSeason(now = new Date()): Season {
  // Northern-hemisphere temperate boundaries. Matches the tagging in
  // scripts/tag-seasons.mjs.
  const m = now.getMonth() + 1; // 1..12
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "fall";
  return "winter";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("season");
  const season: Season = SEASONS.includes(raw as Season)
    ? (raw as Season)
    : currentSeason();
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.min(parseInt(limitRaw, 10) || 12, 30) : 12;

  const repo = getRepository();
  const results = await repo.inSeason(season, limit);
  return NextResponse.json({ season, results });
}
