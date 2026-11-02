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
import { fmt } from "@/lib/i18n/config";
import { areaName, categoryName } from "@/lib/i18n/names";
import { getI18n } from "@/lib/i18n/server";
import { hubPath, listingPath } from "@/lib/paths";
import { breadcrumbJsonLd, faqJsonLd, itemListJsonLd } from "@/lib/seo";

// Area page (/petaling-jaya) and area + category page (/petaling-jaya/barbershop).
export async function HubPage({ areaSlug, categorySlug }: { areaSlug: string; categorySlug: string | null }) {
  const [areas, categories, counts, { locale, t, href }] = await Promise.all([
    getAreas(),
    getCategories(),
    getHubCounts(),
    getI18n(),
  ]);
  const area = areas.find((a) => a.slug === areaSlug);
  const category = categorySlug ? categories.find((c) => c.slug === categorySlug) : null;
  if (!area || (categorySlug && !category)) notFound();

  const [stats, { items, total }] = await Promise.all([
    getHubStats(area.slug, category?.slug ?? null),
    searchListings({ area: area.slug, category: category?.slug }),
  ]);

  const path = areaPath(areas, area);
  const placeName = areaName(area, locale);
  const catName = category ? categoryName(category, locale) : null;
  const crumbs = [
    { name: t.nav.home, path: href("/") },
    ...path
      .filter((a) => a.type !== "state")
      .map((a) => ({ name: areaName(a, locale), path: href(hubPath(a.slug)) })),
    ...(category && catName ? [{ name: catName, path: href(hubPath(area.slug, category.slug)) }] : []),
  ];
  const title = catName
    ? fmt(t.hub.titleCategory, { category: catName, area: placeName })
    : fmt(t.hub.titleArea, { area: placeName });
  const faqs = hubFaqs(area, category ?? null, stats, locale);
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
          itemListJsonLd(title, items.map((l) => ({ name: l.name, path: href(listingPath(l.slug)) }))),
          faqJsonLd(faqs),
        ]}
      />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>
      {category && locale === "en" && <p className="text-muted">{category.name_ms} di {area.name}</p>}
      <p className="mt-3 max-w-3xl text-lg">{hubSummary(area, category ?? null, stats, locale)}</p>

      {categoryLinks.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2 text-sm">
          {categoryLinks.map(({ category: c, count }) => (
            <li key={c.slug}>
              <Link
                href={href(hubPath(area.slug, c.slug))}
                className="inline-block rounded-full border border-line bg-white px-3 py-1.5 hover:border-brand-200"
              >
                {categoryName(c, locale)} <span className="text-muted">({count})</span>
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
            {t.hub.empty} <Link href={href("/for-business")} className="underline">{t.hub.addIt}</Link>.
          </p>
        )}
        {total > items.length && (
          <p className="mt-6 text-center">
            <Link
              href={href(`/search?area=${area.slug}${category ? `&category=${category.slug}` : ""}&page=2`)}
              className="rounded-full border border-line bg-white px-4 py-2 hover:border-brand-200"
            >
              {fmt(t.hub.seeAll, { count: total })}
            </Link>
          </p>
        )}
      </div>

      {nearby.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">
            {catName ? fmt(t.hub.nearbyCategory, { category: catName }) : fmt(t.hub.nearbyArea, { area: placeName })}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {nearby.map(({ area: a, count }) => (
              <li key={a.slug}>
                <Link
                  href={href(hubPath(a.slug, category?.slug))}
                  className="inline-block rounded-full border border-line bg-white px-3 py-1.5 hover:border-brand-200"
                >
                  {areaName(a, locale)} <span className="text-muted">({count})</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 max-w-3xl">
        <h2 className="text-xl font-semibold">{t.hub.questions}</h2>
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
