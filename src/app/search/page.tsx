import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListingGrid } from "@/components/listing-card";
import { SearchFilters } from "@/components/search-filters";
import { PAGE_SIZE, getAreas, getAttributes, getCategories, searchListings } from "@/lib/data/directory";
import type { SearchParams } from "@/lib/types";

// Filtered views are for people, not search engines; the area and category
// hub pages are the indexable versions.
export const metadata: Metadata = {
  title: "Search salons, barbers and beauty shops",
  robots: { index: false, follow: true },
  alternates: { canonical: "/search" },
};

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

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const [categories, areas, attributes] = await Promise.all([getCategories(), getAreas(), getAttributes()]);
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[280px_1fr]">
      <aside>
        <h1 className="mb-4 text-2xl font-bold">Explore</h1>
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
  const [categories, areas, { items, total }] = await Promise.all([
    getCategories(),
    getAreas(),
    searchListings(params),
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
    return `/search?${qs.toString()}`;
  };

  return (
    <>
      <p className="mb-4 text-sm text-muted">
        {total} {total === 1 ? "shop" : "shops"}
        {category ? ` for ${category.name_en.toLowerCase()}` : ""}
        {area ? ` in ${area.name}` : " in Klang Valley"}
      </p>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
          <p className="font-medium">No shops match these filters yet.</p>
          <p className="mt-1 text-sm text-muted">Try a nearby area or remove a filter.</p>
        </div>
      ) : (
        <ListingGrid listings={items} categories={categories} />
      )}
      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-between text-sm" aria-label="Pages">
          {page > 1 ? <Link href={pageHref(page - 1)} className="underline">Previous</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link href={pageHref(page + 1)} className="underline">Next</Link> : <span />}
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
