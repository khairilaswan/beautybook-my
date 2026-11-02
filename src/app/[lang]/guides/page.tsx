import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { getGuides } from "@/lib/data/content";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";

// Guides are written in English; the other languages point search engines
// at the English page.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.growth.guides.metaTitle, description: t.growth.guides.metaDescription, alternates: { canonical: "/guides" } };
}

export default async function GuidesPage() {
  const [guides, { locale, t, href }] = await Promise.all([getGuides(), getI18n()]);
  const g = t.growth.guides;
  const crumbs = [
    { name: t.nav.home, path: href("/") },
    { name: t.growth.nav.guides, path: href("/guides") },
  ];
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          itemListJsonLd(g.title, guides.map((x) => ({ name: x.title, path: href(`/guides/${x.slug}`) }))),
        ]}
      />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{g.title}</h1>
      <p className="mt-2 text-lg text-muted">{g.lead}</p>
      {locale !== "en" && <p className="mt-2 text-sm text-muted">{g.englishOnly}</p>}
      {guides.length === 0 ? (
        <p className="mt-8 text-muted">{g.none}</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {guides.map((x) => (
            <li key={x.slug}>
              <Link href={href(`/guides/${x.slug}`)} className="block h-full rounded-2xl border border-line bg-white p-5 hover:border-brand-200">
                <h2 className="text-lg font-semibold">{x.title}</h2>
                {x.summary && <p className="mt-1 text-sm text-muted">{x.summary}</p>}
                <p className="mt-3 text-xs text-muted">{fmt(g.updated, { date: formatDate(x.updated_at, locale) })}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
