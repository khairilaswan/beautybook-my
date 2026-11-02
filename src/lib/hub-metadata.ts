import type { Metadata } from "next";
import {
  MIN_INDEXABLE_LISTINGS,
  countInTree,
  getAreas,
  getCategories,
  getHubCounts,
} from "@/lib/data/directory";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { type Locale, alternatesFor, fmt } from "@/lib/i18n/config";
import { areaName, categoryName } from "@/lib/i18n/names";
import { hubPath } from "@/lib/paths";

export async function hubMetadata(areaSlug: string, categorySlug: string | null, locale: Locale): Promise<Metadata> {
  "use cache";
  const t = DICTIONARIES[locale];
  const [areas, categories, counts] = await Promise.all([getAreas(), getCategories(), getHubCounts()]);
  const area = areas.find((a) => a.slug === areaSlug);
  const category = categorySlug ? categories.find((c) => c.slug === categorySlug) : null;
  if (!area || (categorySlug && !category)) return { title: t.hub.notFound, robots: { index: false } };

  const count = countInTree(areas, counts, area.slug, category?.slug ?? null);
  const path = hubPath(area.slug, category?.slug);
  const place = areaName(area, locale);
  const catName = category ? categoryName(category, locale) : null;
  const title = catName
    ? fmt(t.hub.metaTitleCategory, { category: catName, area: place, count })
    : fmt(t.hub.titleArea, { area: place });
  let description = catName
    ? fmt(t.hub.metaDescCategory, { count, categoryLower: catName.toLowerCase(), area: place })
    : fmt(t.hub.metaDescArea, { count, area: place });
  // English pages also carry the Malay name, which many people search with.
  if (category && locale === "en") description += ` ${category.name_ms} di ${area.name}.`;
  const alternates = alternatesFor(locale, path);
  return {
    title,
    description,
    alternates,
    openGraph: { title, description, url: alternates.canonical },
    robots: count < MIN_INDEXABLE_LISTINGS ? { index: false, follow: true } : undefined,
  };
}
