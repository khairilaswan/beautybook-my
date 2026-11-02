import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListingGrid } from "@/components/listing-card";
import { MapView } from "@/components/map-view";
import { SearchFilters } from "@/components/search-filters";
import { PAGE_SIZE, getAreas, getAttributes, getCategories, searchListings } from "@/lib/data/directory";
import { getFeatureSettings } from "@/lib/data/features";
import { alternatesFor, fmt } from "@/lib/i18n/config";
import { areaName, categoryName } from "@/lib/i18n/names";
import { getI18n } from "@/lib/i18n/server";
import { type RawParams, parseSearchParams, searchQueryString } from "@/lib/search-params";

// Filtered views are for people, not search engines; the area and category
// hub pages are the indexable versions.
export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return {
    title: t.search.metaTitle,
    robots: { index: false, follow: true },
    alternates: alternatesFor(locale, "/search"),
  };
}

const MAP_LIMIT = 200;

export default async function SearchPage({ searchParams }: PageProps<"/[lang]/search">) {
  const [categories, areas, attributes, { t }] = await Promise.all([
    getCategories(),
    getAreas(),
    getAttributes(),
    getI18n(),
  ]);
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[280px_1fr]">
      <aside>
        <h1 className="mb-4 text-2xl font-bold">{t.search.title}</h1>
        <Suspense>
          <SearchFilters categories={categories} areas={areas} attributes={attributes} />
        </Suspense>
      </aside>
      <section aria-live="polite">
        <Suspense fallback={<ResultsSkeleton />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </section>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = parseSearchParams(await searchParams);
  const isMap = params.view === "map";
  const [categories, areas, { items, total }, features, { locale, t, href: localHref }] = await Promise.all([
    getCategories(),
    getAreas(),
    searchListings(isMap ? { ...params, page: 1, pageSize: MAP_LIMIT } : params),
    getFeatureSettings(),
    getI18n(),
  ]);
  const area = areas.find((a) => a.slug === params.area);
  const category = categories.find((c) => c.slug === params.category);
  const page = params.page ?? 1;
  const pages = isMap ? 1 : Math.ceil(total / PAGE_SIZE);
  const href = (changes: Record<string, string | null>) => localHref(`/search?${searchQueryString(params, changes)}`);
  const g = t.growth.search;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {total === 1 ? t.search.countOne : fmt(t.search.countMany, { count: total })}
          {category ? fmt(t.search.forCategory, { category: categoryName(category, locale).toLowerCase() }) : ""}
          {params.near
            ? fmt(g.withinKm, { km: params.radiusKm ?? 10 })
            : fmt(t.search.inArea, { area: area ? areaName(area, locale) : t.common.klangValley })}
        </p>
        <div className="flex rounded-full border border-line bg-white p-0.5 text-sm" role="group" aria-label={g.view}>
          <Link
            href={href({ view: null, page: null })}
            aria-current={!isMap ? "page" : undefined}
            className={`rounded-full px-3 py-1 ${!isMap ? "bg-ink text-white" : ""}`}
          >
            {g.list}
          </Link>
          <Link
            href={href({ view: "map", page: null })}
            aria-current={isMap ? "page" : undefined}
            className={`rounded-full px-3 py-1 ${isMap ? "bg-ink text-white" : ""}`}
          >
            {g.map}
          </Link>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
          <p className="font-medium">{t.search.noneTitle}</p>
          <p className="mt-1 text-sm text-muted">{params.near ? g.noneNear : t.search.noneBody}</p>
        </div>
      ) : isMap ? (
        <MapView listings={items} center={params.near} />
      ) : (
        <ListingGrid listings={items} categories={categories} showRatings={features.reviewsEnabled} />
      )}
      {isMap && total > items.length && (
        <p className="mt-2 text-xs text-muted">{fmt(g.mapLimit, { count: items.length })}</p>
      )}
      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-between text-sm" aria-label={t.search.pages}>
          {page > 1 ? <Link href={href({ page: String(page - 1) })} className="underline">{t.search.previous}</Link> : <span />}
          <span className="text-muted">{fmt(t.search.pageOf, { page, pages })}</span>
          {page < pages ? <Link href={href({ page: String(page + 1) })} className="underline">{t.search.next}</Link> : <span />}
        </nav>
      )}
    </>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-64 animate-pulse rounded-2xl bg-white" />
      ))}
    </div>
  );
}
