import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { RecentSearches } from "@/components/recent-searches";
import { getAreas, getCategories, getMalls } from "@/lib/data/directory";
import { hubPath, mallPath } from "@/lib/paths";
import { areaName, categoryName } from "@/lib/i18n/names";
import { getI18n } from "@/lib/i18n/server";
import { siteJsonLd } from "@/lib/seo";

export default async function HomePage() {
  const [categories, areas, malls, { locale, t, href }] = await Promise.all([
    getCategories(),
    getAreas(),
    getMalls(),
    getI18n(),
  ]);
  const cities = areas.filter((a) => a.type === "city");

  return (
    <>
      <JsonLd data={siteJsonLd()} />
      <section className="theme-hero bg-gradient-to-b from-brand-50 to-canvas">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-14 sm:pt-20">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            {t.home.title}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">{t.home.lead}</p>
          <form
            action={href("/search")}
            className="mt-8 grid max-w-3xl gap-2 rounded-2xl border border-line bg-white p-2 shadow-sm sm:grid-cols-[1fr_1fr_auto]"
          >
            <label className="sr-only" htmlFor="home-category">{t.common.service}</label>
            <select id="home-category" name="category" className="rounded-xl px-3 py-3">
              <option value="">{t.home.anyService}</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{categoryName(c, locale)}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="home-area">{t.common.area}</label>
            <select id="home-area" name="area" className="rounded-xl px-3 py-3">
              <option value="">{t.common.allKlangValley}</option>
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>{areaName(c, locale)}</option>
              ))}
            </select>
            <button className="rounded-xl bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700">
              {t.common.search}
            </button>
          </form>
          <div className="mt-6">
            <RecentSearches />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-xl font-semibold">{t.home.browseByService}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={href(`/search?category=${c.slug}`)}
              className="rounded-2xl border border-line bg-white p-4 hover:border-brand-200 hover:shadow-sm"
            >
              <span className="font-medium">{categoryName(c, locale)}</span>
              <span className="mt-0.5 block text-sm text-muted">{locale === "en" ? c.name_ms : c.name_en}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="text-xl font-semibold">{t.home.browseByArea}</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {cities.map((c) => (
            <li key={c.slug}>
              <Link
                href={href(hubPath(c.slug))}
                className="inline-block rounded-full border border-line bg-white px-4 py-2 text-sm hover:border-brand-200"
              >
                {areaName(c, locale)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {malls.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-6">
          <h2 className="text-xl font-semibold">{t.growth.malls.browse}</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {malls.slice(0, 12).map((m) => (
              <li key={m.slug}>
                <Link
                  href={href(mallPath(m.slug))}
                  className="inline-block rounded-full border border-line bg-white px-4 py-2 text-sm hover:border-brand-200"
                >
                  {m.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href={href(mallPath())} className="inline-block px-2 py-2 text-sm underline">
                {t.growth.malls.seeAllMalls}
              </Link>
            </li>
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 rounded-3xl bg-ink p-8 text-white sm:grid-cols-[2fr_1fr] sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold">{t.home.ownerTitle}</h2>
            <p className="mt-2 text-white/75">{t.home.ownerBody}</p>
          </div>
          <Link
            href={href("/for-business")}
            className="justify-self-start rounded-full bg-white px-5 py-3 font-medium text-ink hover:bg-brand-50 sm:justify-self-end"
          >
            {t.home.ownerCta}
          </Link>
        </div>
      </section>
    </>
  );
}
