import type { Metadata } from "next";
import Link from "next/link";
import { PearLetter } from "@/components/PearLetter";

export const metadata: Metadata = {
  title: "Privacy Policy — Flavor Pear",
  description:
    "How Flavor Pear handles your data — short version: we don't collect any.",
};

// The policy is intentionally small and concrete because the app's
// architecture is small and concrete. If anything here drifts from how the
// app actually works, fix the app or fix the policy.
export default function PrivacyPolicy() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="mb-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-3xl sm:text-4xl font-semibold tracking-tight text-ink hover:opacity-80 transition"
        >
          Flav
          <span className="text-pear">
            <PearLetter />
          </span>
          r Pear
        </Link>
      </header>

      <article className="prose-flavor">
        <h1 className="text-2xl font-semibold text-ink mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted mb-8">Last updated: April 26, 2026</p>

        <p className="mb-6 leading-relaxed">
          Flavor Pear is a small web tool for discovering ingredient pairings
          and recipes. This page explains exactly what data the app handles —
          there isn&apos;t much.
        </p>

        <Section title="What the app does not collect">
          <p>
            Flavor Pear has no user accounts, no analytics, and no advertising
            trackers. The app does not collect, store, or transmit your usage
            data to any server we control. There is no &ldquo;us&rdquo; tracking what
            you do.
          </p>
        </Section>

        <Section title="What is stored on your device">
          <p>
            When you save a combo, save a recipe, pin a saved item, or add
            personal notes to a recipe, that information is written to your
            browser&apos;s <code className="bg-hover px-1.5 py-0.5 rounded text-sm">localStorage</code>{" "}
            under the keys <code className="bg-hover px-1.5 py-0.5 rounded text-sm">flavor-pear:combos</code>{" "}
            and <code className="bg-hover px-1.5 py-0.5 rounded text-sm">flavor-pear:saved-recipes</code>.
          </p>
          <p>
            That data stays on your device. The author of the app cannot read
            it. Clearing your browser data, switching browsers, or using a
            different device will reset what&apos;s stored.
          </p>
        </Section>

        <Section title="Hosting and source code">
          <p>
            The app is hosted on Vercel and the source code is on GitHub.
            Vercel keeps standard server access logs (IP address, user agent,
            request URL, timestamp) for operational purposes — see{" "}
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pear hover:underline"
            >
              Vercel&apos;s privacy policy
            </a>{" "}
            for details.
          </p>
        </Section>

        <Section title="External links">
          <p>
            When you click <em>Find recipe online</em> on a recipe, the app
            opens a Google search in a new tab. Anything you do on Google after
            that is governed by Google&apos;s terms.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Flavor Pear is not directed at children under 13. The app does not
            knowingly collect data from children, and since it does not collect
            data from anyone, this is straightforward.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If the way the app handles data changes — for example, if it later
            adds accounts or remote storage — this page will be updated and the
            date at the top will move forward. The change will be visible in
            the public commit history of the GitHub repository.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or concerns? Open an issue on the GitHub repository:{" "}
            <a
              href="https://github.com/ashtonmorrow/spicerack/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pear hover:underline"
            >
              github.com/ashtonmorrow/spicerack
            </a>
            .
          </p>
        </Section>
      </article>

      <footer className="mt-16 text-xs text-muted text-center">
        <Link href="/" className="hover:text-ink transition">
          ← Back to Flavor Pear
        </Link>
      </footer>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold text-ink mb-2">{title}</h2>
      <div className="text-sm text-ink/90 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
