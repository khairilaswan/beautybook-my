import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type {
  Area,
  Attribute,
  Category,
  ListingCard,
  ListingDetail,
  Mall,
  SearchParams,
} from "@/lib/types";

// Public directory reads. Everything here is shared by all visitors, so it is
// cached and tagged; writes call updateTag/revalidateTag with these tags.
export const tags = {
  taxonomy: "taxonomy",
  listings: "listings",
  listing: (slug: string) => `listing:${slug}`,
};

export const PAGE_SIZE = 24;

export function todayInMalaysia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
}
// Hub pages with fewer shops than this get noindex and stay out of the sitemap.
export const MIN_INDEXABLE_LISTINGS = 3;

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("days");
  cacheTag(tags.taxonomy);
  const { data, error } = await createPublicClient()
    .from("categories")
    .select("id, slug, slug_ms, name_en, name_ms, name_zh, schema_type, sort_order, rebook_days")
    .order("sort_order");
  if (error) throw error;
  return data;
}

export async function getAreas(): Promise<Area[]> {
  "use cache";
  cacheLife("days");
  cacheTag(tags.taxonomy);
  const { data, error } = await createPublicClient()
    .from("areas")
    .select("id, parent_id, type, name, slug, lat, lng, sort_order")
    .order("sort_order");
  if (error) throw error;
  return data as Area[];
}

export async function getAttributes(): Promise<Attribute[]> {
  "use cache";
  cacheLife("days");
  cacheTag(tags.taxonomy);
  const { data, error } = await createPublicClient()
    .from("attributes")
    .select("id, slug, group_name, name_en, name_ms")
    .order("group_name")
    .order("sort_order");
  if (error) throw error;
  return data as Attribute[];
}

export async function getMalls(): Promise<Mall[]> {
  "use cache";
  cacheLife("days");
  cacheTag(tags.taxonomy);
  const { data, error } = await createPublicClient()
    .from("malls")
    .select("id, slug, name, area_id, address, lat, lng, sort_order")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data as Mall[];
}

export async function getMall(slug: string): Promise<Mall | null> {
  const malls = await getMalls();
  return malls.find((m) => m.slug === slug) ?? null;
}

// Active shops per mall slug.
export async function getMallCounts(): Promise<Map<string, number>> {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.listings);
  const { data, error } = await createPublicClient().rpc("mall_counts");
  if (error) throw error;
  return new Map((data as { mall_slug: string; listing_count: number }[]).map((r) => [r.mall_slug, Number(r.listing_count)]));
}

export async function getCategory(slug: string): Promise<Category | null> {
  const categories = await getCategories();
  return categories.find((c) => c.slug === slug) ?? null;
}

export async function getArea(slug: string): Promise<Area | null> {
  const areas = await getAreas();
  return areas.find((a) => a.slug === slug) ?? null;
}

export function areaPath(areas: Area[], area: Area | null): Area[] {
  const path: Area[] = [];
  let current = area;
  while (current) {
    path.unshift(current);
    current = areas.find((a) => a.id === current!.parent_id) ?? null;
  }
  return path;
}

export function childAreas(areas: Area[], parent: Area): Area[] {
  return areas.filter((a) => a.parent_id === parent.id);
}

// Areas that share a parent with `area` (or its children, for a city).
export function nearbyAreas(areas: Area[], area: Area): Area[] {
  const children = childAreas(areas, area);
  if (children.length > 0) return children;
  return areas.filter((a) => a.parent_id === area.parent_id && a.id !== area.id);
}

export type HubCount = { area_slug: string; category_slug: string | null; listing_count: number };

export async function getHubCounts(): Promise<HubCount[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.listings);
  const { data, error } = await createPublicClient().rpc("hub_counts");
  if (error) throw error;
  return (data as HubCount[]).map((r) => ({ ...r, listing_count: Number(r.listing_count) }));
}

// Shops in an area and every area under it, optionally for one category.
export function countInTree(
  areas: Area[],
  counts: HubCount[],
  areaSlug: string,
  categorySlug: string | null = null,
): number {
  const root = areas.find((a) => a.slug === areaSlug);
  if (!root) return 0;
  const inTree = new Set<string>();
  const walk = (a: Area) => {
    inTree.add(a.slug);
    childAreas(areas, a).forEach(walk);
  };
  walk(root);
  return counts
    .filter((c) => inTree.has(c.area_slug) && c.category_slug === categorySlug)
    .reduce((sum, c) => sum + c.listing_count, 0);
}

export async function searchListings(params: SearchParams): Promise<{
  items: ListingCard[];
  total: number;
}> {
  "use cache";
  cacheLife("minutes");
  cacheTag(tags.listings);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? PAGE_SIZE;
  const { data, error } = await createPublicClient().rpc("search_listings", {
    p_query: params.q?.trim() || null,
    p_category: params.category || null,
    p_area: params.area || null,
    p_attributes: params.attributes?.length ? params.attributes : null,
    p_gender: params.gender ?? null,
    p_open_now: params.openNow ?? false,
    p_open_late: params.openLate ?? false,
    p_max_price: params.maxPrice ?? null,
    p_lat: params.near?.lat ?? null,
    p_lng: params.near?.lng ?? null,
    p_radius_km: params.near ? (params.radiusKm ?? 15) : null,
    p_sort: params.sort ?? null,
    p_slugs: params.slugs?.length ? params.slugs : null,
    p_mall: params.mall || null,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw error;
  const items = ((data ?? []) as ListingCard[]).map((l) => ({
    ...l,
    min_price: l.min_price === null ? null : Number(l.min_price),
    max_price: l.max_price === null ? null : Number(l.max_price),
    rating_avg: l.rating_avg === null ? null : Number(l.rating_avg),
    rating_count: Number(l.rating_count),
  }));
  return { items, total: items.length > 0 ? Number(items[0].total_count) : 0 };
}

export async function getListing(slug: string): Promise<ListingDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.listing(slug));
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("listings")
    .select(
      `id, slug, name, status, address, postcode, lat, lng, phone, whatsapp, website,
       instagram, facebook, description, price_level, gender, last_verified_at, updated_at, area_id,
       listing_categories ( is_primary, categories ( id, slug, slug_ms, name_en, name_ms, name_zh, schema_type, sort_order ) ),
       listing_attributes ( attributes ( id, slug, group_name, name_en, name_ms ) ),
       services ( id, name, price_from, price_to, duration_min, sort_order ),
       opening_hours ( weekday, opens, closes ),
       closures ( date_from, date_to, note ),
       photos ( id, storage_path, alt, sort_order, kind, caption, category_id ),
       shop_staff ( id, name, title, bio, photo_path, languages, is_active, sort_order ),
       promotions ( id, title, details, price_label, occasion, starts_on, ends_on ),
       packages ( id, kind, name, description, includes, price_from, price_to, sort_order ),
       listing_service_areas ( area_id ),
       booking_settings ( instant_enabled, slot_minutes, capacity, min_notice_hours, max_days_ahead ),
       voucher_settings ( enabled, amounts, valid_months, terms ),
       loyalty_programs ( enabled, stamps_required, reward ),
       malls ( slug, name )`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  type Row = Omit<
    ListingDetail,
    | "is_claimed" | "area" | "area_path" | "categories" | "attributes" | "services" | "services_are_template"
    | "hours" | "closures" | "photos" | "staff" | "promotions" | "packages" | "service_areas" | "booking"
    | "vouchers" | "loyalty" | "mall"
  > & {
    area_id: number | null;
    listing_categories: { is_primary: boolean; categories: Category }[];
    listing_attributes: { attributes: Attribute }[];
    services: (ListingDetail["services"][number] & { sort_order: number })[];
    opening_hours: ListingDetail["hours"];
    closures: ListingDetail["closures"];
    photos: (ListingDetail["photos"][number] & { sort_order: number })[];
    shop_staff: (ListingDetail["staff"][number] & { is_active: boolean; sort_order: number })[];
    promotions: ListingDetail["promotions"];
    packages: (ListingDetail["packages"][number] & { sort_order: number })[];
    listing_service_areas: { area_id: number }[];
    // One-to-one tables come back as an object (or null), not a list.
    booking_settings: ListingDetail["booking"];
    voucher_settings: ListingDetail["vouchers"];
    loyalty_programs: ListingDetail["loyalty"];
    malls: ListingDetail["mall"];
  };
  const row = data as unknown as Row;

  const [areas, claimed] = await Promise.all([
    getAreas(),
    supabase.rpc("listing_is_claimed", { p_listing_id: row.id }),
  ]);
  const area = areas.find((a) => a.id === row.area_id) ?? null;


  const categories = row.listing_categories
    .map((lc) => ({ ...lc.categories, is_primary: lc.is_primary }))
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);

  let services = [...row.services].sort((a, b) => a.sort_order - b.sort_order);
  let servicesAreTemplate = false;
  if (services.length === 0 && categories.length > 0) {
    const { data: templates } = await supabase
      .from("service_templates")
      .select("id, name_en, name_ms, duration_min, sort_order")
      .eq("category_id", categories[0].id)
      .order("sort_order");
    services = (templates ?? []).map((t) => ({
      id: -t.id,
      name: t.name_en,
      name_ms: t.name_ms,
      price_from: null,
      price_to: null,
      duration_min: t.duration_min,
      sort_order: t.sort_order,
    }));
    servicesAreTemplate = services.length > 0;
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    address: row.address,
    postcode: row.postcode,
    lat: row.lat,
    lng: row.lng,
    phone: row.phone,
    whatsapp: row.whatsapp,
    website: row.website,
    instagram: row.instagram,
    facebook: row.facebook,
    description: row.description,
    price_level: row.price_level,
    gender: row.gender,
    last_verified_at: row.last_verified_at,
    updated_at: row.updated_at,
    is_claimed: claimed.data === true,
    area,
    mall: row.malls ?? null,
    area_path: areaPath(areas, area),
    categories,
    attributes: row.listing_attributes.map((la) => la.attributes),
    services,
    services_are_template: servicesAreTemplate,
    hours: row.opening_hours,
    closures: row.closures,
    photos: [...row.photos].sort((a, b) => a.sort_order - b.sort_order),
    staff: row.shop_staff.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    promotions: row.promotions
      .filter((p) => p.ends_on >= todayInMalaysia())
      .sort((a, b) => a.ends_on.localeCompare(b.ends_on)),
    packages: [...row.packages]
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map((p) => ({
        ...p,
        price_from: p.price_from === null ? null : Number(p.price_from),
        price_to: p.price_to === null ? null : Number(p.price_to),
      })),
    service_areas: row.listing_service_areas
      .map((sa) => areas.find((a) => a.id === sa.area_id))
      .filter((a): a is Area => !!a),
    booking: row.booking_settings,
    vouchers: row.voucher_settings?.enabled ? row.voucher_settings : null,
    loyalty: row.loyalty_programs?.enabled ? row.loyalty_programs : null,
  };
}

// Active listings for the sitemap and generateStaticParams.
export async function getListingSlugs(): Promise<{ slug: string; updated_at: string }[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.listings);
  const { data, error } = await createPublicClient()
    .from("listings")
    .select("slug, updated_at")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(50000);
  if (error) throw error;
  return data;
}

export async function getRedirect(path: string): Promise<string | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.listings);
  const { data } = await createPublicClient()
    .from("redirects")
    .select("to_path")
    .eq("from_path", path)
    .maybeSingle();
  return data?.to_path ?? null;
}

export type HubStats = {
  listing_count: number;
  min_price: number | null;
  max_price: number | null;
  priced_count: number;
  open_late_count: number;
  last_verified_at: string | null;
};

export async function getHubStats(areaSlug: string, categorySlug: string | null): Promise<HubStats> {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.listings);
  const { data, error } = await createPublicClient()
    .rpc("hub_stats", { p_area: areaSlug, p_category: categorySlug })
    .single();
  if (error) throw error;
  const row = data as Record<string, string | number | null>;
  const num = (v: string | number | null) => (v === null ? null : Number(v));
  return {
    listing_count: Number(row.listing_count),
    min_price: num(row.min_price),
    max_price: num(row.max_price),
    priced_count: Number(row.priced_count),
    open_late_count: Number(row.open_late_count),
    last_verified_at: row.last_verified_at as string | null,
  };
}
