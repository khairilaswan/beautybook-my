import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListingGrid } from "@/components/listing-card";
import { SearchFilters } from "@/components/search-filters";
import { PAGE_SIZE, getAreas, getAttributes, getCategories, searchListings } from "@/lib/data/directory";
import { alternatesFor, fmt } from "@/lib/i18n/config";
import { areaName, categoryName } from "@/lib/i18n/names";
import { getI18n } from "@/lib/i18n/server";
import type { SearchParams } from "@/lib/types";

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

type RawParams = Record<string, string | string[] | undefined>;

function parseParams(raw: RawParams): SearchParams {
  const one = (k: string) => (Array.isArray(raw[k]) ? raw[k][0] : raw[k]) ?? undefined;
  const many = (k: string) => (Array.isArray(raw[k]) ? raw[k] : raw[k] ? [raw[k]] : []);
  const gender = one("for");
  return {
    q: one("q")?.slice(0, 100),
    category: one("category"),
    area: one("area"),
    attributes: many("attr").slice(0, 10),
    gender: gender === "men" || gender === "women" ? gender : undefined,
    openNow: one("open") === "1",
    page: Number(one("page")) || 1,
  };
}

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
  const params = parseParams(await searchParams);
  const [categories, areas, { items, total }, { locale, t, href }] = await Promise.all([
    getCategories(),
    getAreas(),
    searchListings(params),
    getI18n(),
  ]);
  const area = areas.find((a) => a.slug === params.area);
  const category = categories.find((c) => c.slug === params.category);
  const page = params.page ?? 1;
  const pages = Math.ceil(total / PAGE_SIZE);

  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.category) qs.set("category", params.category);
    if (params.area) qs.set("area", params.area);
    params.attributes?.forEach((a) => qs.append("attr", a));
    if (params.gender) qs.set("for", params.gender);
    if (params.openNow) qs.set("open", "1");
    qs.set("page", String(p));
    return href(`/search?${qs.toString()}`);
  };

  return (
    <>
      <p className="mb-4 text-sm text-muted">
        {total === 1 ? t.search.countOne : fmt(t.search.countMany, { count: total })}
        {category ? fmt(t.search.forCategory, { category: categoryName(category, locale).toLowerCase() }) : ""}
        {fmt(t.search.inArea, { area: area ? areaName(area, locale) : t.common.klangValley })}
      </p>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
          <p className="font-medium">{t.search.noneTitle}</p>
          <p className="mt-1 text-sm text-muted">{t.search.noneBody}</p>
        </div>
      ) : (
        <ListingGrid listings={items} categories={categories} />
      )}
      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-between text-sm" aria-label={t.search.pages}>
          {page > 1 ? <Link href={pageHref(page - 1)} className="underline">{t.search.previous}</Link> : <span />}
          <span className="text-muted">{fmt(t.search.pageOf, { page, pages })}</span>
          {page < pages ? <Link href={pageHref(page + 1)} className="underline">{t.search.next}</Link> : <span />}
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
