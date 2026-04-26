import Link from "next/link";
import { PRIMARY_LINKS, SITE_LINKS, type SiteLink } from "@/lib/links";

interface Props {
  /** Optional hint shown above the link rows (e.g. keyboard tips). */
  hint?: string;
  /** Optional back-link rendered on the first line in place of the hint. */
  backLink?: { href: string; label: string };
}

export function Footer({ hint, backLink }: Props) {
  return (
    <footer className="mt-16 text-xs text-muted text-center space-y-2">
      {hint && <p>{hint}</p>}
      {backLink && (
        <p>
          <Link href={backLink.href} className="hover:text-ink transition">
            {backLink.label}
          </Link>
        </p>
      )}
      <LinkRow links={PRIMARY_LINKS} />
      <LinkRow links={SITE_LINKS} />
    </footer>
  );
}

function LinkRow({ links }: { links: SiteLink[] }) {
  return (
    <p>
      {links.map((link, i) => (
        <span key={link.href}>
          {link.internal ? (
            <Link
              href={link.href}
              className="hover:text-ink transition"
            >
              {link.label}
            </Link>
          ) : (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink transition"
            >
              {link.label}
            </a>
          )}
          {i < links.length - 1 && (
            <span className="mx-2 opacity-50">·</span>
          )}
        </span>
      ))}
    </p>
  );
}
