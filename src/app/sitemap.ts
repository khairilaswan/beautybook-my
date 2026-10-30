import type { MetadataRoute } from "next";
import { MIN_INDEXABLE_LISTINGS, countInTree, getAreas, getCategories, getHubCounts, getListingSlugs } from "@/lib/data/directory";
import { absoluteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [areas, categories, counts, listings] = await Promise.all([
    getAreas(),
    getCategories(),
    getHubCounts(),
    getListingSlugs(),
  ]);
  const hubs: MetadataRoute.Sitemap = [];
  for (const area of areas) {
    if (countInTree(areas, counts, area.slug) >= MIN_INDEXABLE_LISTINGS) {
      hubs.push({ url: absoluteUrl(`/${area.slug}`), changeFrequency: "weekly", priority: 0.8 });
    }
    for (const category of categories) {
      if (countInTree(areas, counts, area.slug, category.slug) >= MIN_INDEXABLE_LISTINGS) {
        hubs.push({ url: absoluteUrl(`/${area.slug}/${category.slug}`), changeFrequency: "weekly", priority: 0.9 });
      }
    }
  }
  return [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/for-business"), changeFrequency: "monthly", priority: 0.5 },
    ...hubs,
    ...listings.map((l) => ({
      url: absoluteUrl(`/shop/${l.slug}`),
      lastModified: l.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
