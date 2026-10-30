import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { ListingGrid } from "@/components/listing-card";
import {
  areaPath,
  countInTree,
  getAreas,
  getCategories,
  getHubCounts,
  getHubStats,
  nearbyAreas,
  searchListings,
} from "@/lib/data/directory";
import { hubFaqs, hubSummary } from "@/lib/hub";
import { breadcrumbJsonLd, faqJsonLd, itemListJsonLd } from "@/lib/seo";

// Area page (/petaling-jaya) and area + category page (/petaling-jaya/barbershop).
export async function HubPage({ areaSlug, categorySlug }: { areaSlug: string; categorySlug: string | null }) {
  const [areas, categories, counts] = await Promise.all([getAreas(), getCategories(), getHubCounts()]);
  const area = areas.find((a) => a.slug === areaSlug);
  const category = categorySlug ? categories.find((c) => c.slug === categorySlug) : null;
  if (!area || (categorySlug && !category)) notFound();

  const [stats, { items, total }] = await Promise.all([
    getHubStats(area.slug, category?.slug ?? null),
    searchListings({ area: area.slug, category: category?.slug }),
  ]);

  const path = areaPath(areas, area);
  const crumbs = [
    { name: "Home", path: "/" },
    ...path.filter((a) => a.type !== "state").map((a) => ({ name: a.name, path: `/${a.slug}` })),
    ...(category ? [{ name: category.name_en, path: `/${area.slug}/${category.slug}` }] : []),
  ];
  const title = category ? `${category.name_en} in ${area.name}` : `Salons, barbers and beauty in ${area.name}`;
  const faqs = hubFaqs(area, category ?? null, stats);
  const nearby = nearbyAreas(areas, area)
    .map((a) => ({ area: a, count: countInTree(areas, counts, a.slug, category?.slug ?? null) }))
    .filter((n) => n.count > 0);
  const categoryLinks = categories
    .map((c) => ({ category: c, count: countInTree(areas, counts, area.slug, c.slug) }))
    .filter((c) => c.count > 0 && c.category.slug !== category?.slug);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          itemListJsonLd(title, items.map((l) => ({ name: l.name, path: `/shop/${l.slug}` }))),
          faqJsonLd(faqs),
        ]}
      />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>
      {category && <p className="text-muted">{category.name_ms} di {area.name}</p>}
      <p className="mt-3 max-w-3xl text-lg">{hubSummary(area, category ?? null, stats)}</p>

      {categoryLinks.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2 text-sm">
          {categoryLinks.map(({ category: c, count }) => (
            <li key={c.slug}>
              <Link
                href={`/${area.slug}/${c.slug}`}
                className="inline-block rounded-full border border-line bg-white px-3 py-1.5 hover:border-brand-200"
              >
                {c.name_en} <span className="text-muted">({count})</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        {items.length > 0 ? (
          <ListingGrid listings={items} categories={categories} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-muted">
            No shops listed here yet. Know one? <Link href="/for-business" className="underline">Add it</Link>.
          </p>
        )}
        {total > items.length && (
          <p className="mt-6 text-center">
            <Link
              href={`/search?area=${area.slug}${category ? `&category=${category.slug}` : ""}&page=2`}
              className="rounded-full border border-line bg-white px-4 py-2 hover:border-brand-200"
            >
              See all {total}
            </Link>
          </p>
        )}
      </div>

      {nearby.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">
            {category ? `${category.name_en} nearby` : `Areas in and around ${area.name}`}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {nearby.map(({ area: a, count }) => (
              <li key={a.slug}>
                <Link
                  href={category ? `/${a.slug}/${category.slug}` : `/${a.slug}`}
                  className="inline-block rounded-full border border-line bg-white px-3 py-1.5 hover:border-brand-200"
                >
                  {a.name} <span className="text-muted">({count})</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 max-w-3xl">
        <h2 className="text-xl font-semibold">Questions</h2>
        <dl className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
          {faqs.map((f) => (
            <div key={f.question} className="p-4">
              <dt className="font-medium">{f.question}</dt>
              <dd className="mt-1 text-muted">{f.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

export function HubSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-8">
      <div className="h-4 w-48 rounded bg-white" />
      <div className="mt-4 h-9 w-2/3 rounded bg-white" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-64 rounded-2xl bg-white" />
        ))}
      </div>
    </div>
  );
}
