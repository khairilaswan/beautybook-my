import type { Metadata } from "next";
import {
  MIN_INDEXABLE_LISTINGS,
  countInTree,
  getAreas,
  getCategories,
  getHubCounts,
} from "@/lib/data/directory";

export async function hubMetadata(areaSlug: string, categorySlug: string | null): Promise<Metadata> {
  "use cache";
  const [areas, categories, counts] = await Promise.all([getAreas(), getCategories(), getHubCounts()]);
  const area = areas.find((a) => a.slug === areaSlug);
  const category = categorySlug ? categories.find((c) => c.slug === categorySlug) : null;
  if (!area || (categorySlug && !category)) return { title: "Not found", robots: { index: false } };

  const count = countInTree(areas, counts, area.slug, category?.slug ?? null);
  const path = category ? `/${area.slug}/${category.slug}` : `/${area.slug}`;
  const title = category
    ? `${category.name_en} in ${area.name} (${count})`
    : `Salons, barbers and beauty in ${area.name}`;
  const description = category
    ? `Compare ${count} ${category.name_en.toLowerCase()} in ${area.name}: services, prices and opening hours. Book on WhatsApp. ${category.name_ms} di ${area.name}.`
    : `Find ${count} salons, barbers, nail and beauty shops in ${area.name}. See services and prices, then book on WhatsApp.`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path },
    robots: count < MIN_INDEXABLE_LISTINGS ? { index: false, follow: true } : undefined,
  };
}
