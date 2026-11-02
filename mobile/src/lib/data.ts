import { malaysiaNow } from "@/lib/hours";
import { supabase } from "@/lib/supabase";
import type {
  Area,
  Attribute,
  Category,
  ListingCard,
  ListingDetail,
  Mall,
  SearchParams,
} from "@/lib/types";

// Directory reads, ported from the website's src/lib/data/directory.ts. They
// run as the signed-in user; row-level security returns the same public rows.

export const PAGE_SIZE = 24;

export function todayInMalaysia(): string {
  return malaysiaNow().date;
}

// Categories, areas, attributes and malls change rarely: load once per launch.
let taxonomy: Promise<{ categories: Category[]; areas: Area[]; attributes: Attribute[]; malls: Mall[] }> | null = null;

export function getTaxonomy() {
  if (!taxonomy) {
    taxonomy = (async () => {
      const [categories, areas, attributes, malls] = await Promise.all([
        supabase
          .from("categories")
          .select("id, slug, slug_ms, name_en, name_ms, name_zh, schema_type, sort_order, rebook_days")
          .order("sort_order"),
        supabase.from("areas").select("id, parent_id, type, name, slug, lat, lng, sort_order").order("sort_order"),
        supabase.from("attributes").select("id, slug, group_name, name_en, name_ms").order("group_name").order("sort_order"),
        supabase.from("malls").select("id, slug, name, area_id, address, lat, lng, sort_order").order("sort_order").order("name"),
      ]);
      for (const r of [categories, areas, attributes]) if (r.error) throw r.error;
      return {
        categories: categories.data as Category[],
        areas: areas.data as Area[],
        attributes: attributes.data as Attribute[],
        // Malls arrived later (shopping-malls-setup.sql); without them the
        // mall filter just stays hidden.
        malls: (malls.error ? [] : malls.data) as Mall[],
      };
    })().catch((e) => {
      taxonomy = null;
      throw e;
    });
  }
  return taxonomy;
}

export async function getMallCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc("mall_counts");
  if (error) return new Map();
  return new Map((data as { mall_slug: string; listing_count: number }[]).map((r) => [r.mall_slug, Number(r.listing_count)]));
}

export function areaPath(areas: Area[], area: Area | null): Area[] {
  const path: Area[] = [];
  let current = area;
  while (current) {
    path.unshift(current);
    const parentId: number | null = current.parent_id;
    current = areas.find((a) => a.id === parentId) ?? null;
  }
  return path;
}

export async function searchListings(params: SearchParams): Promise<{ items: ListingCard[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? PAGE_SIZE;
  const { data, error } = await supabase.rpc("search_listings", {
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
    distance_km: l.distance_km === null ? null : Number(l.distance_km),
  }));
  return { items, total: items.length > 0 ? Number(items[0].total_count) : 0 };
}

const KIND_ORDER: Record<ListingDetail["photos"][number]["kind"], number> = { shop: 0, team: 1, portfolio: 2 };

export async function getListing(slug: string): Promise<ListingDetail | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(
      `id, slug, name, status, address, postcode, lat, lng, phone, whatsapp, website,
       instagram, facebook, description, price_level, gender, last_verified_at, updated_at, area_id, video_path,
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
    booking_settings: ListingDetail["booking"];
    voucher_settings: ListingDetail["vouchers"];
    loyalty_programs: ListingDetail["loyalty"];
    malls: ListingDetail["mall"];
  };
  const row = data as unknown as Row;

  const [{ areas }, claimed] = await Promise.all([
    getTaxonomy(),
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

  const today = todayInMalaysia();
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
    photos: [...row.photos].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.sort_order - b.sort_order || a.id - b.id),
    video_path: row.video_path,
    staff: row.shop_staff.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    promotions: row.promotions.filter((p) => p.ends_on >= today).sort((a, b) => a.ends_on.localeCompare(b.ends_on)),
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

export type Review = {
  id: number;
  author_name: string;
  rating: number;
  body: string | null;
  service_name: string | null;
  owner_reply: string | null;
  created_at: string;
};

export async function getReviews(listingId: string): Promise<{ reviews: Review[]; average: number | null; count: number }> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, author_name, rating, body, service_name, owner_reply, created_at")
    .eq("listing_id", listingId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { reviews: [], average: null, count: 0 };
  const reviews = data as Review[];
  const count = reviews.length;
  const average = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : null;
  return { reviews, average, count };
}

export type Deal = {
  id: number;
  title: string;
  price_label: string | null;
  ends_on: string;
  listing: { slug: string; name: string };
};

// Deals running today at active shops, soonest ending first.
export async function getDeals(limit = 10): Promise<Deal[]> {
  const today = todayInMalaysia();
  const { data, error } = await supabase
    .from("promotions")
    .select("id, title, price_label, ends_on, listings!inner ( slug, name, status )")
    .lte("starts_on", today)
    .gte("ends_on", today)
    .eq("listings.status", "active")
    .order("ends_on")
    .limit(limit);
  if (error) return [];
  return (data as unknown as (Omit<Deal, "listing"> & { listings: { slug: string; name: string } })[]).map((d) => ({
    id: d.id,
    title: d.title,
    price_label: d.price_label,
    ends_on: d.ends_on,
    listing: { slug: d.listings.slug, name: d.listings.name },
  }));
}
