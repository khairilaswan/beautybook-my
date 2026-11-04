import Link from "next/link";
import Image from "next/image";
import { getWebsiteSettings } from "@/lib/data/website-settings";
import { JsonLd } from "@/components/json-ld";
import { RecentSearches } from "@/components/recent-searches";
import { getAreas, getCategories, getMalls } from "@/lib/data/directory";
import { hubPath, mallPath } from "@/lib/paths";
import { areaName, categoryName } from "@/lib/i18n/names";
import { getI18n } from "@/lib/i18n/server";
import { siteJsonLd } from "@/lib/seo";

export default async function HomePage() {
  const [categories, areas, malls, { locale, t, href }, website] = await Promise.all([
    getCategories(),
    getAreas(),
    getMalls(),
    getI18n(),
    getWebsiteSettings(),
  ]);
  const cities = areas.filter((a) => a.type === "city");

  return (
    <>
      <JsonLd data={siteJsonLd(website.name, website.logo)} />
      <section className="theme-hero bg-gradient-to-b from-brand-50 to-canvas">
        <div className="mx-auto max-w-6xl px-4 pt-6 pb-6">
          <div className={`relative isolate overflow-hidden ${website.heroImage ? "rounded-3xl" : ""}`}>
          {website.heroImage && <>
            <Image src={website.heroImage} alt={website.heroAlt} fill sizes="(min-width: 1152px) 1120px, calc(100vw - 32px)" className="-z-20 object-cover object-right" preload />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-white/85 sm:bg-linear-to-r sm:from-white/95 sm:via-white/80 sm:to-white/5" />
          </>}
          <div className={`relative flex flex-col justify-center ${website.heroImage ? "min-h-[440px] px-6 py-10 text-slate-950 sm:min-h-[480px] sm:px-10 lg:px-12" : "py-10 sm:py-14"}`}>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            {website[locale].heroTitle || t.home.title}
          </h1>
          <p className={`mt-4 max-w-xl text-lg ${website.heroImage ? "text-slate-700" : "text-muted"}`}>{website[locale].heroLead || t.home.lead}</p>
          <form
            action={href("/search")}
            className="mt-8 grid w-full max-w-2xl gap-2 rounded-2xl border border-line bg-white p-2 shadow-sm sm:grid-cols-[1fr_1fr_auto]"
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
              {website.categoryImages[c.slug] && <div className="relative mb-3 aspect-square overflow-hidden rounded-xl"><Image src={website.categoryImages[c.slug]} alt="" fill sizes="(min-width: 640px) 240px, 45vw" className="object-cover" /></div>}
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
            {website.businessImage && <div className="relative mb-5 aspect-[2/1] overflow-hidden rounded-xl"><Image src={website.businessImage} alt={website.businessAlt} fill sizes="(min-width: 640px) 640px, 90vw" className="object-cover" /></div>}
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
