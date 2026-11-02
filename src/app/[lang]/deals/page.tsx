import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { getLiveDeals } from "@/lib/data/content";
import { getAreas } from "@/lib/data/directory";
import { formatDate } from "@/lib/format";
import { malaysiaNow } from "@/lib/hours";
import { alternatesFor, fmt } from "@/lib/i18n/config";
import { areaName } from "@/lib/i18n/names";
import { getI18n } from "@/lib/i18n/server";
import { listingPath } from "@/lib/paths";
import { OCCASIONS, type Occasion } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return {
    title: t.growth.deals.metaTitle,
    description: t.growth.deals.metaDescription,
    alternates: alternatesFor(locale, "/deals"),
  };
}

export default async function DealsPage({ searchParams }: PageProps<"/[lang]/deals">) {
  const { t, href } = await getI18n();
  const g = t.growth.deals;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ name: t.nav.home, path: href("/") }, { name: t.growth.nav.deals, path: href("/deals") }]} />
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{g.title}</h1>
      <p className="mt-2 text-lg text-muted">{g.lead}</p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-2xl bg-white" />}>
        <Deals searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Deals({ searchParams }: { searchParams: PageProps<"/[lang]/deals">["searchParams"] }) {
  const [{ occasion }, { locale, t, href }] = await Promise.all([searchParams, getI18n()]);
  const g = t.growth.deals;
  const pick = OCCASIONS.includes(occasion as Occasion) ? (occasion as Occasion) : null;
  const today = malaysiaNow().date;
  const [deals, areas] = await Promise.all([getLiveDeals(today), getAreas()]);
  const live = deals.filter((d) => d.ends_on >= today);
  const shown = pick ? live.filter((d) => d.occasion === pick) : live;
  const occasions = OCCASIONS.filter((o) => live.some((d) => d.occasion === o));
  return (
    <>
      {occasions.length > 1 && (
        <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label={t.growth.quote.occasion}>
          <Link href={href("/deals")} className={`rounded-full border px-3 py-1 ${!pick ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
            {t.growth.portfolio.all}
          </Link>
          {occasions.map((o) => (
            <Link
              key={o}
              href={href(`/deals?occasion=${o}`)}
              className={`rounded-full border px-3 py-1 ${pick === o ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
            >
              {t.growth.occasions[o]}
            </Link>
          ))}
        </nav>
      )}
      {shown.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line bg-white p-10 text-center text-muted">
          {g.none}
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((d) => (
            <li key={d.id} className="flex flex-col rounded-2xl border border-line bg-white p-5 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t.growth.occasions[d.occasion]}</p>
              <p className="mt-1 text-lg font-semibold">{d.title}</p>
              {d.price_label && <p className="font-medium">{d.price_label}</p>}
              {d.details && <p className="mt-1 line-clamp-3 text-muted">{d.details}</p>}
              <p className="mt-3">
                <Link href={href(listingPath(d.listing.slug))} className="font-medium underline">{d.listing.name}</Link>
                <span className="text-muted"> · {(() => {
                  const a = areas.find((x) => x.id === d.listing.area_id);
                  return a ? areaName(a, locale) : "";
                })()}</span>
              </p>
              <p className="text-xs text-muted">
                {d.starts_on > today ? `${fmt(g.starts, { date: formatDate(d.starts_on, locale) })} · ` : ""}
                {fmt(g.until, { date: formatDate(d.ends_on, locale) })}
              </p>
              <Link
                href={href(`${listingPath(d.listing.slug)}?deal=${d.id}#book`)}
                className="mt-3 self-start rounded-full bg-ink px-3 py-1.5 text-white"
              >
                {t.growth.shop.bookDeal}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
