import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { ListingGrid } from "@/components/listing-card";
import { getGuide, getGuides } from "@/lib/data/content";
import { getAreas, getCategories, searchListings } from "@/lib/data/directory";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { areaName, categoryName } from "@/lib/i18n/names";
import { getI18n } from "@/lib/i18n/server";
import { Markdown } from "@/lib/markdown";
import { hubPath } from "@/lib/paths";
import { absoluteUrl, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo";

export async function generateStaticParams() {
  const guides = await getGuides();
  // At least one param, so the route is prerendered rather than fully dynamic.
  return guides.length ? guides.map((g) => ({ slug: g.slug })) : [{ slug: "_" }];
}

export async function generateMetadata({ params }: PageProps<"/[lang]/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) return { robots: { index: false } };
  // Written in English: every language's copy points at the English page.
  return {
    title: guide.title,
    description: guide.summary ?? undefined,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: { title: guide.title, description: guide.summary ?? undefined, type: "article", url: `/guides/${guide.slug}` },
  };
}

export default async function GuidePage({ params }: PageProps<"/[lang]/guides/[slug]">) {
  const { slug } = await params;
  const [guide, areas, categories, { locale, t, href }] = await Promise.all([
    getGuide(slug),
    getAreas(),
    getCategories(),
    getI18n(),
  ]);
  const g = t.growth.guides;
  if (!guide) notFound();
  const area = areas.find((a) => a.id === guide.area_id) ?? null;
  const category = categories.find((c) => c.id === guide.category_id) ?? null;
  const shops =
    area || category ? (await searchListings({ area: area?.slug, category: category?.slug, pageSize: 6 })).items : [];
  const crumbs = [
    { name: t.nav.home, path: href("/") },
    { name: t.growth.nav.guides, path: href("/guides") },
    { name: guide.title, path: href(`/guides/${guide.slug}`) },
  ];
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.summary ?? undefined,
    datePublished: guide.published_at ?? undefined,
    dateModified: guide.updated_at,
    mainEntityOfPage: absoluteUrl(`/guides/${guide.slug}`),
    author: { "@type": "Organization", name: "BeautyBook", url: absoluteUrl("/") },
    publisher: { "@type": "Organization", name: "BeautyBook", url: absoluteUrl("/") },
    about: [area && { "@type": "Place", name: area.name }, category && { "@type": "Thing", name: category.name_en }].filter(Boolean),
  };
  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={[article, breadcrumbJsonLd(crumbs), ...(guide.faqs.length ? [faqJsonLd(guide.faqs)] : [])]} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{guide.title}</h1>
      {guide.summary && <p className="mt-3 text-lg">{guide.summary}</p>}
      <p className="mt-2 text-sm text-muted">{fmt(g.updated, { date: formatDate(guide.updated_at, locale) })}</p>
      {locale !== "en" && <p className="mt-1 text-sm text-muted">{g.englishOnly}</p>}
      <div className="mt-8">
        <Markdown source={guide.body} />
      </div>

      {shops.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">
            {fmt(area ? g.shopsIn : g.shopsOn, {
              what: category ? categoryName(category, locale) : g.shops,
              area: area ? areaName(area, locale) : "",
            })}
          </h2>
          <div className="mt-4">
            <ListingGrid listings={shops} categories={categories} />
          </div>
          {area && (
            <p className="mt-4">
              <Link href={href(hubPath(area.slug, category?.slug))} className="underline">
                {fmt(g.seeEvery, {
                  what: category ? categoryName(category, locale).toLowerCase() : g.shops.toLowerCase(),
                  area: areaName(area, locale),
                })}
              </Link>
            </p>
          )}
        </section>
      )}

      {guide.faqs.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">{g.questions}</h2>
          <dl className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {guide.faqs.map((f) => (
              <div key={f.question} className="p-4">
                <dt className="font-medium">{f.question}</dt>
                <dd className="mt-1 text-muted">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </article>
  );
}
