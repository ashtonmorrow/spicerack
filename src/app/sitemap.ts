import type { MetadataRoute } from "next";
import { listRecipes } from "@/lib/recipes";
import { SITE_URL } from "@/lib/site";

// Statically generated sitemap covering the home page, privacy, and every
// curated/imported recipe detail page. Combos are localStorage-only so they
// don't appear in the sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const recipeEntries: MetadataRoute.Sitemap = listRecipes().map((r) => ({
    url: `${SITE_URL}/recipes/${r.id}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));
  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...recipeEntries,
  ];
}
