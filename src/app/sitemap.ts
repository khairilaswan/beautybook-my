import type { MetadataRoute } from "next";
import {
  MIN_INDEXABLE_LISTINGS,
  countInTree,
  getAreas,
  getCategories,
  getHubCounts,
  getListingSlugs,
  getMallCounts,
} from "@/lib/data/directory";
import { LOCALES, languageAlternates, localePath } from "@/lib/i18n/config";
import { hubPath, listingPath, mallPath } from "@/lib/paths";
import { getGuides } from "@/lib/data/content";
import { absoluteUrl } from "@/lib/seo";
import { membersOnly } from "@/lib/site-access";

type Entry = Omit<MetadataRoute.Sitemap[number], "url" | "alternates"> & { path: string };

// Every page is listed once per language, each carrying hreflang links to
// all its versions (en-MY, ms-MY, zh-MY and x-default = English).
function localized(entries: Entry[]): MetadataRoute.Sitemap {
  return entries.flatMap(({ path, ...rest }) => {
    const languages = languageAlternates(path, absoluteUrl);
    return LOCALES.map((l) => ({ ...rest, url: absoluteUrl(localePath(l, path)), alternates: { languages } }));
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (membersOnly) return [];
  const [areas, categories, counts, listings, guides, mallCounts] = await Promise.all([
    getAreas(),
    getCategories(),
    getHubCounts(),
    getListingSlugs(),
    getGuides(),
    getMallCounts(),
  ]);
  const hubs: Entry[] = [];
  for (const area of areas) {
    if (countInTree(areas, counts, area.slug) >= MIN_INDEXABLE_LISTINGS) {
      hubs.push({ path: hubPath(area.slug), changeFrequency: "weekly", priority: 0.8 });
    }
    for (const category of categories) {
      if (countInTree(areas, counts, area.slug, category.slug) >= MIN_INDEXABLE_LISTINGS) {
        hubs.push({ path: hubPath(area.slug, category.slug), changeFrequency: "weekly", priority: 0.9 });
      }
    }
  }
  const malls: Entry[] = [...mallCounts]
    .filter(([, count]) => count >= MIN_INDEXABLE_LISTINGS)
    .map(([slug]) => ({ path: mallPath(slug), changeFrequency: "weekly", priority: 0.8 }));
  // Guides are written in English only, so they are listed once.
  const englishOnly: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/guides"), changeFrequency: "weekly", priority: 0.7 },
    ...guides.map((g) => ({
      url: absoluteUrl(`/guides/${g.slug}`),
      lastModified: g.updated_at,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
  return [
    ...localized([
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/for-business", changeFrequency: "monthly", priority: 0.5 },
    { path: "/deals", changeFrequency: "daily", priority: 0.6 },
    ...hubs,
    { path: mallPath(), changeFrequency: "weekly", priority: 0.6 },
    ...malls,
    ...listings.map((l) => ({
      path: listingPath(l.slug),
      lastModified: l.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ]),
    ...englishOnly,
  ];
}
