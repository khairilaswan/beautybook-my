import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { OpenStatus } from "@/components/open-status";
import { getListing } from "@/lib/data/directory";
import { getFeatureSettings } from "@/lib/data/features";
import { getRatingSummary } from "@/lib/data/reviews";
import { photoUrl, priceLabel, priceRangeLabel } from "@/lib/format";
import { weeklySchedule } from "@/lib/hours";
import { type Locale, alternatesFor, fmt } from "@/lib/i18n/config";
import { areaName, attributeName, categoryName, serviceName, weekdayName } from "@/lib/i18n/names";
import { getI18n } from "@/lib/i18n/server";
import { listingPath } from "@/lib/paths";
import type { ListingDetail } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return {
    title: t.growth.compare.title,
    robots: { index: false, follow: true },
    alternates: alternatesFor(locale, "/compare"),
  };
}

export default async function ComparePage({ searchParams }: PageProps<"/[lang]/compare">) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t.growth.compare.title}</h1>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-2xl bg-white" />}>
        <Comparison searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function priceSpan(l: ListingDetail, locale: Locale): string | null {
  const own = l.services_are_template ? [] : l.services.filter((s) => s.price_from !== null);
  if (own.length === 0) return null;
  const min = Math.min(...own.map((s) => Number(s.price_from)));
  const max = Math.max(...own.map((s) => Number(s.price_to ?? s.price_from)));
  return priceRangeLabel(min, max, locale);
}

async function Comparison({ searchParams }: { searchParams: PageProps<"/[lang]/compare">["searchParams"] }) {
  const raw = (await searchParams).s;
  const { locale, t, href } = await getI18n();
  const g = t.growth.compare;
  const slugs = [...new Set(String(Array.isArray(raw) ? raw[0] : (raw ?? "")).split(","))]
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{1,100}$/.test(s))
    .slice(0, 3);
  const [found, features] = await Promise.all([Promise.all(slugs.map((s) => getListing(s))), getFeatureSettings()]);
  const listings = found.filter((l): l is ListingDetail => !!l && l.status === "active");
  if (listings.length < 2) {
    return (
      <p className="mt-6 rounded-2xl border border-dashed border-line bg-white p-10 text-center text-muted">
        {g.empty}{" "}
        <Link href={href("/search")} className="underline">{t.account.findShop}</Link>
      </p>
    );
  }
  const ratings = features.reviewsEnabled ? await Promise.all(listings.map((l) => getRatingSummary(l.id))) : null;
  const todayRows = (l: ListingDetail) => weeklySchedule(l.hours, locale);
  const r = g.rows;

  const rows: { label: string; cell: (l: ListingDetail, i: number) => React.ReactNode }[] = [
    { label: r.type, cell: (l) => l.categories.map((c) => categoryName(c, locale)).join(", ") || "—" },
    { label: t.common.area, cell: (l) => (l.area ? areaName(l.area, locale) : "—") },
    { label: r.prices, cell: (l) => priceSpan(l, locale) ?? r.askShop },
    ...(ratings
      ? [{
          label: r.rating,
          cell: (_l: ListingDetail, i: number) =>
            ratings[i].count > 0
              ? `★ ${ratings[i].average} · ${fmt(t.growth.reviews.fromMany, { count: ratings[i].count })}`
              : r.noReviews,
        }]
      : []),
    { label: r.rightNow, cell: (l) => (l.hours.length ? <OpenStatus hours={l.hours} closures={l.closures} /> : r.noHours) },
    {
      label: r.hours,
      cell: (l) =>
        l.hours.length ? (
          <ul className="space-y-0.5 text-xs">
            {todayRows(l).map((d) => (
              <li key={d.weekday}>
                <span className="inline-block w-12 text-muted">{weekdayName(d.weekday, locale, "short")}</span>
                {d.slots.length ? d.slots.join(", ") : t.common.closed}
              </li>
            ))}
          </ul>
        ) : (
          "—"
        ),
    },
    { label: r.for, cell: (l) => (l.gender ? t.common.gender[l.gender] : "—") },
    {
      label: t.shop.goodToKnow,
      cell: (l) =>
        l.attributes.filter((a) => a.group_name !== "language").map((a) => attributeName(a, locale)).join(", ") || "—",
    },
    {
      label: t.growth.filters.staffSpeak,
      cell: (l) =>
        l.attributes.filter((a) => a.group_name === "language").map((a) => attributeName(a, locale)).join(", ") || "—",
    },
    {
      label: r.popular,
      cell: (l) => (
        <ul className="space-y-0.5 text-xs">
          {l.services.slice(0, 6).map((s) => (
            <li key={s.id}>
              {serviceName(s, locale)}
              {priceLabel(s, locale) ? <span className="text-muted"> · {priceLabel(s, locale)}</span> : null}
            </li>
          ))}
        </ul>
      ),
    },
    { label: t.growth.shop.deals, cell: (l) => (l.promotions.length ? l.promotions.map((p) => p.title).join(", ") : "—") },
    { label: r.booking, cell: (l) => (l.booking?.instant_enabled ? r.instant : r.whatsapp) },
    {
      label: t.growth.shop.comesToYou,
      cell: (l) => (l.service_areas.length ? l.service_areas.map((a) => areaName(a, locale)).join(", ") : "—"),
    },
  ];

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-x-2 text-sm">
        <thead>
          <tr>
            <th className="w-32" />
            {listings.map((l) => (
              <th key={l.id} scope="col" className="text-left align-top font-normal">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-brand-50">
                  {l.photos[0] && (
                    <Image src={photoUrl(l.photos[0].storage_path)} alt="" fill sizes="33vw" className="object-cover" />
                  )}
                </div>
                <Link href={href(listingPath(l.slug))} className="mt-2 block text-base font-semibold hover:underline">
                  {l.name}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="border-t border-line py-3 pr-2 text-left align-top font-medium text-muted">
                {row.label}
              </th>
              {listings.map((l, i) => (
                <td key={l.id} className="border-t border-line py-3 align-top">{row.cell(l, i)}</td>
              ))}
            </tr>
          ))}
          <tr>
            <td />
            {listings.map((l) => (
              <td key={l.id} className="pt-4">
                <Link
                  href={href(`${listingPath(l.slug)}#book`)}
                  className="inline-block rounded-full bg-whatsapp px-4 py-2 font-medium text-white"
                >
                  {t.growth.account.book}
                </Link>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
