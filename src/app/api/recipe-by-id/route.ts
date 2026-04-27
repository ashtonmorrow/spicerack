import { NextRequest, NextResponse } from "next/server";
import { getRecipeById } from "@/lib/recipes";

// GET /api/recipe-by-id?id=caprese
// Lightweight lookup by recipe id, used by the home page when arriving via
// a /recipes/[id] "Use these ingredients" deep link.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ recipe: null });
  const recipe = getRecipeById(id);
  return NextResponse.json({ recipe });
}
