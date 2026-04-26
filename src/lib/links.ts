// Cross-property links surfaced in the footer. Single source of truth so the
// home page, privacy page, and preview HTML all agree.
//
// If any of these URLs is wrong, fix it here — every footer reads from this.
export interface SiteLink {
  href: string;
  label: string;
  /** internal Next.js routes set this to true so we use <Link> not <a> */
  internal?: boolean;
}

export const PRIMARY_LINKS: SiteLink[] = [
  { href: "/privacy", label: "Privacy", internal: true },
  { href: "https://github.com/ashtonmorrow/spicerack", label: "Source" },
];

export const SITE_LINKS: SiteLink[] = [
  { href: "https://mike-lee.me", label: "mike-lee.me" },
  { href: "https://ski.mike-lee.me", label: "Ski" },
  { href: "https://pounce.mike-lee.me", label: "Pounce" },
  { href: "https://go.mike-lee.me", label: "Go" },
  { href: "https://www.linkedin.com/in/mike-lee/", label: "Whisker-leaks" },
];
