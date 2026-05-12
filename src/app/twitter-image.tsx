// Twitter card image. Same size and content as the OG image — Twitter's
// summary_large_image card uses 2:1 dimensions identical to OG (1200×630).
// Keeping the file separate so Next.js auto-detects it and emits a distinct
// <meta name="twitter:image"> tag.

export { default, runtime, alt, size, contentType } from "./opengraph-image";
