import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { HubSkeleton } from "@/components/hub-page";
import { JsonLd } from "@/components/json-ld";
import { ListingGrid } from "@/components/listing-card";
import {
  MIN_INDEXABLE_LISTINGS,
  getAreas,
  getCategories,
  getMallCounts,
  getMalls,
  searchListings,
} from "@/lib/data/directory";
import { getFeatureSettings } from "@/lib/data/features";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { type Locale, alternatesFor, fmt } from "@/lib/i18n/config";
import { areaName, categoryName } from "@/lib/i18n/names";
import { getI18n, getLocale } from "@/lib/i18n/server";
import { mallCity } from "@/lib/mall";
import { hubPath, listingPath, mallPath } from "@/lib/paths";
import { absoluteUrl, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";

// A mall holds a few dozen shops at most; show them all on one page.
const MALL_PAGE_SIZE = 200;

async function mallMetadata(slug: string, locale: Locale): Promise<Metadata> {
  "use cache";
  const t = DICTIONARIES[locale];
  const [malls, counts] = await Promise.all([getMalls(), getMallCounts()]);
  const mall = malls.find((m) => m.slug === slug);
  if (!mall) return { title: t.hub.notFound, robots: { index: false } };
  const count = counts.get(mall.slug) ?? 0;
  const title = fmt(t.growth.malls.title, { mall: mall.name });
  const description = fmt(t.growth.malls.metaDesc, { mall: mall.name, count });
  const alternates = alternatesFor(locale, mallPath(mall.slug));
  return {
    title,
    description,
    alternates,
    openGraph: { title, description, url: alternates.canonical },
    robots: count < MIN_INDEXABLE_LISTINGS ? { index: false, follow: true } : undefined,
  };
}

export async function generateMetadata({ params }: PageProps<"/[lang]/mall/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return mallMetadata(slug, await getLocale());
}

export default function MallPage({ params }: PageProps<"/[lang]/mall/[slug]">) {
  return (
    <Suspense fallback={<HubSkeleton />}>
      <Mall params={params} />
    </Suspense>
  );
}

async function Mall({ params }: { params: PageProps<"/[lang]/mall/[slug]">["params"] }) {
  const { slug } = await params;
  const [malls, areas, categories, counts, { locale, t, href }] = await Promise.all([
    getMalls(),
    getAreas(),
    getCategories(),
    getMallCounts(),
    getI18n(),
  ]);
  const mall = malls.find((m) => m.slug === slug);
  if (!mall) notFound();
  const [{ items }, features] = await Promise.all([
    searchListings({ mall: mall.slug, pageSize: MALL_PAGE_SIZE }),
    getFeatureSettings(),
  ]);

  const m = t.growth.malls;
  const area = areas.find((a) => a.id === mall.area_id) ?? null;
  const city = mallCity(mall, areas);
  const title = fmt(m.title, { mall: mall.name });
  const crumbs = [
    { name: t.nav.home, path: href("/") },
    { name: m.malls, path: href(mallPath()) },
    { name: mall.name, path: href(mallPath(mall.slug)) },
  ];
  // Services on offer here, most shops first; each opens search inside this mall.
  const categoryCounts = categories
    .map((c) => ({ category: c, count: items.filter((l) => l.primary_category === c.slug).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
  const others = malls
    .filter((o) => o.slug !== mall.slug && city && mallCity(o, areas)?.id === city.id)
    .map((o) => ({ mall: o, count: counts.get(o.slug) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.mall.name.localeCompare(b.mall.name));
  const shoppingCenter = {
    "@context": "https://schema.org",
    "@type": "ShoppingCenter",
    "@id": absoluteUrl(`${mallPath(mall.slug)}#mall`),
    name: mall.name,
    url: absoluteUrl(href(mallPath(mall.slug))),
    address: mall.address
      ? { "@type": "PostalAddress", streetAddress: mall.address, addressLocality: area?.name, addressCountry: "MY" }
      : undefined,
    geo: mall.lat !== null && mall.lng !== null ? { "@type": "GeoCoordinates", latitude: mall.lat, longitude: mall.lng } : undefined,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          shoppingCenter,
          itemListJsonLd(title, items.map((l) => ({ name: l.name, path: href(listingPath(l.slug)) }))),
        ]}
      />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted">
        {mall.address}
        {area && (
          <>
            {mall.address ? " · " : ""}
            <Link href={href(hubPath(area.slug))} className="underline hover:text-ink">{areaName(area, locale)}</Link>
          </>
        )}
      </p>

      {categoryCounts.length > 1 && (
        <ul className="mt-6 flex flex-wrap gap-2 text-sm">
          {categoryCounts.map(({ category: c, count }) => (
            <li key={c.slug}>
              <Link
                href={href(`/search?mall=${mall.slug}&category=${c.slug}`)}
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
          <ListingGrid listings={items} categories={categories} showRatings={features.reviewsEnabled} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-muted">
            {t.hub.empty} <Link href={href("/for-business")} className="underline">{t.hub.addIt}</Link>.
          </p>
        )}
      </div>

      {others.length > 0 && city && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">{fmt(m.otherMalls, { area: areaName(city, locale) })}</h2>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {others.map(({ mall: o, count }) => (
              <li key={o.slug}>
                <Link
                  href={href(mallPath(o.slug))}
                  className="inline-block rounded-full border border-line bg-white px-3 py-1.5 hover:border-brand-200"
                >
                  {o.name} {count > 0 && <span className="text-muted">({count})</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-8 text-sm">
        <Link href={href(mallPath())} className="underline">{m.allMalls}</Link>
      </p>
    </div>
  );
}
