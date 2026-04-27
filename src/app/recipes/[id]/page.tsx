import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PearLetter } from "@/components/PearLetter";
import { Footer } from "@/components/Footer";
import { getRecipeById, listRecipes } from "@/lib/recipes";
import { getRepository } from "@/lib/repository";
import { SITE_URL, SITE_NAME, AUTHOR } from "@/lib/site";

// Pre-render every recipe at build time so search engines can crawl them.
export function generateStaticParams() {
  return listRecipes().map((r) => ({ id: r.id }));
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const recipe = getRecipeById(params.id);
  if (!recipe) return { title: `Recipe not found — ${SITE_NAME}` };
  const title = `${recipe.name} — ${SITE_NAME}`;
  const description = recipe.about || `Recipe for ${recipe.name}.`;
  const url = `${SITE_URL}/recipes/${recipe.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "article",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function RecipePage({
  params,
}: {
  params: { id: string };
}) {
  const recipe = getRecipeById(params.id);
  if (!recipe) notFound();

  const repo = getRepository();
  const allSlugs = [...recipe.required, ...(recipe.optional ?? [])];
  const resolved = await Promise.all(allSlugs.map((s) => repo.getBySlug(s)));
  const lookup = new Map<
    string,
    { slug: string; name: string; category: string }
  >();
  for (const i of resolved) {
    if (i)
      lookup.set(i.slug, { slug: i.slug, name: i.name, category: i.category });
  }
  const nameOf = (slug: string) => lookup.get(slug)?.name ?? prettify(slug);

  // JSON-LD Recipe schema — gives search engines a structured view.
  const recipeSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.name,
    description: recipe.about,
    url: `${SITE_URL}/recipes/${recipe.id}`,
    recipeIngredient: [
      ...recipe.required.map(nameOf),
      ...(recipe.optional ?? []).map(nameOf),
    ],
    author: {
      "@type": "Person",
      name: AUTHOR.name,
      alternateName: AUTHOR.alternateName,
      url: AUTHOR.url,
    },
  };
  if (recipe.cuisine) recipeSchema.recipeCuisine = recipe.cuisine;
  if (recipe.course) recipeSchema.recipeCategory = recipe.course;
  if (recipe.servings != null) recipeSchema.recipeYield = String(recipe.servings);
  if (recipe.time) recipeSchema.totalTime = `PT${recipe.time}M`;
  if (recipe.method) {
    recipeSchema.recipeInstructions = [
      { "@type": "HowToStep", text: recipe.method },
    ];
  }

  const meta = [
    recipe.cuisine,
    recipe.course,
    recipe.time ? `${recipe.time} min` : null,
    recipe.servings ? `serves ${recipe.servings}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const findUrl =
    recipe.sourceUrl ??
    `https://www.google.com/search?q=${encodeURIComponent(
      recipe.name + " recipe"
    )}`;
  const findLabel =
    recipe.source === "themealdb" ? "View on TheMealDB" : "Find recipe online";

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(recipeSchema) }}
      />

      <header className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink hover:opacity-80 transition"
        >
          Flav
          <span className="text-pear">
            <PearLetter />
          </span>
          r Pear
        </Link>
        <p className="text-xs text-muted mt-1">
          <Link href="/" className="hover:text-ink transition">
            ← Back to ingredient picker
          </Link>
        </p>
      </header>

      <article>
        <h1 className="text-3xl sm:text-4xl font-semibold text-ink tracking-tight mb-2">
          {recipe.name}
        </h1>
        {meta && <p className="text-sm text-muted mb-2">{meta}</p>}
        {recipe.source === "themealdb" && (
          <p className="text-[11px] text-muted/80 mb-4">
            Imported from TheMealDB · click <em>View on TheMealDB</em> below for
            the full method.
          </p>
        )}
        {recipe.about && (
          <p className="text-base text-ink leading-relaxed mt-3 mb-6">
            {recipe.about}
          </p>
        )}

        <section className="mb-6">
          <h2 className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">
            Required ingredients
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {recipe.required.map((slug) => {
              const ing = lookup.get(slug);
              const cat = ing?.category ?? "pantry";
              return (
                <span
                  key={slug}
                  className={`text-sm px-2.5 py-1 rounded cat-${cat}`}
                >
                  {ing?.name ?? prettify(slug)}
                </span>
              );
            })}
          </div>
        </section>

        {recipe.optional && recipe.optional.length > 0 && (
          <section className="mb-6">
            <h2 className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">
              Optional
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {recipe.optional.map((slug) => {
                const ing = lookup.get(slug);
                const cat = ing?.category ?? "pantry";
                return (
                  <span
                    key={slug}
                    className={`text-sm px-2.5 py-1 rounded italic cat-${cat}`}
                  >
                    {ing?.name ?? prettify(slug)}
                  </span>
                );
              })}
            </div>
          </section>
        )}

        {recipe.method && (
          <section className="mb-6">
            <h2 className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">
              Method
            </h2>
            <p className="text-base text-ink leading-relaxed">
              {recipe.method}
            </p>
          </section>
        )}

        {recipe.tips && (
          <section className="mb-6">
            <h2 className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">
              Tip
            </h2>
            <p className="text-base text-muted leading-relaxed">
              {recipe.tips}
            </p>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-8 pt-6 border-t border-border">
          <Link
            href={`/?use=${recipe.id}`}
            className="text-sm px-3 py-1.5 rounded bg-pear text-white hover:brightness-95 transition font-medium"
          >
            Use these ingredients
          </Link>
          <a
            href={findUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-3 py-1.5 rounded text-muted hover:text-ink hover:bg-hover transition"
          >
            {findLabel} ↗
          </a>
        </div>
      </article>

      <Footer backLink={{ href: "/", label: "← Back to Flavor Pear" }} />
    </main>
  );
}

function prettify(slug: string): string {
  return slug
    .split("-")
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}
