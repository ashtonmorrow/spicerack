// Single source of truth for the canonical site URL and identity used in
// metadata, JSON-LD, and OG tags. Keep this consistent across every route
// so search engines and social previews see one coherent identity.

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pear.mike-lee.me";

export const SITE_NAME = "Flavor Pear";

export const SITE_DESCRIPTION =
  "Type an ingredient. Get pairings, recipes, and dish directions, fast.";

export const AUTHOR = {
  name: "Mike Lee",
  alternateName: "Whisker Leaks",
  url: "https://mike-lee.me",
  linkedin: "https://www.linkedin.com/in/mikelee89/",
};

export const THEME_COLOR = "#FFFFFF";
export const ACCENT_COLOR = "#1A7F37"; // pear green
