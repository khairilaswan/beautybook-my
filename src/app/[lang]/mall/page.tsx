import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { getAreas, getMallCounts, getMalls } from "@/lib/data/directory";
import { alternatesFor, fmt } from "@/lib/i18n/config";
import { areaName } from "@/lib/i18n/names";
import { getI18n } from "@/lib/i18n/server";
import { mallGroups } from "@/lib/mall";
import { mallPath } from "@/lib/paths";
import { breadcrumbJsonLd } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  const m = t.growth.malls;
  const alternates = alternatesFor(locale, mallPath());
  return {
    title: m.indexTitle,
    description: m.indexMeta,
    alternates,
    openGraph: { title: m.indexTitle, description: m.indexMeta, url: alternates.canonical },
  };
}

export default function MallsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white" />}>
        <Malls />
      </Suspense>
    </div>
  );
}

async function Malls() {
  const [malls, areas, counts, { locale, t, href }] = await Promise.all([getMalls(), getAreas(), getMallCounts(), getI18n()]);
  const m = t.growth.malls;
  const crumbs = [
    { name: t.nav.home, path: href("/") },
    { name: m.malls, path: href(mallPath()) },
  ];
  const shops = (count: number) => (count === 0 ? m.noShops : count === 1 ? m.shopsOne : fmt(m.shopsMany, { count }));
  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(crumbs)]} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{m.indexTitle}</h1>
      <p className="mt-3 max-w-3xl text-lg">{m.indexIntro}</p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {mallGroups(malls, areas).map(({ city, malls: inCity }) => (
          <section key={city?.slug ?? "other"} className="rounded-2xl border border-line bg-white p-4">
            <h2 className="text-lg font-semibold">{city ? areaName(city, locale) : t.common.klangValley}</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {inCity.map((mall) => {
                const count = counts.get(mall.slug) ?? 0;
                return (
                  <li key={mall.slug} className="flex items-baseline justify-between gap-3">
                    <Link href={href(mallPath(mall.slug))} className="hover:underline">{mall.name}</Link>
                    <span className="shrink-0 text-muted">{shops(count)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
