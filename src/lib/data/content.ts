import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { Occasion } from "@/lib/types";

export const GUIDES_TAG = "guides";

export type GuideSummary = {
  slug: string;
  title: string;
  summary: string | null;
  area_id: number | null;
  category_id: number | null;
  published_at: string | null;
  updated_at: string;
};

export type Guide = GuideSummary & { body: string; faqs: { question: string; answer: string }[] };

export async function getGuides(): Promise<GuideSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(GUIDES_TAG);
  const { data, error } = await createPublicClient()
    .from("guides")
    .select("slug, title, summary, area_id, category_id, published_at, updated_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(500);
  if (error) return [];
  return data;
}

export async function getGuide(slug: string): Promise<Guide | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(GUIDES_TAG);
  const { data } = await createPublicClient()
    .from("guides")
    .select("slug, title, summary, body, faqs, area_id, category_id, published_at, updated_at")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as Guide | null) ?? null;
}

export type LiveDeal = {
  id: number;
  title: string;
  details: string | null;
  price_label: string | null;
  occasion: Occasion;
  starts_on: string;
  ends_on: string;
  listing: { slug: string; name: string; area_id: number | null };
};

// Deals running today or starting soon, at live shops.
export async function getLiveDeals(today: string): Promise<LiveDeal[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("listings");
  const { data, error } = await createPublicClient()
    .from("promotions")
    .select("id, title, details, price_label, occasion, starts_on, ends_on, listings!inner ( slug, name, area_id, status )")
    .gte("ends_on", today)
    .eq("listings.status", "active")
    .order("ends_on")
    .limit(200);
  if (error) return [];
  return (data as unknown as (Omit<LiveDeal, "listing"> & { listings: LiveDeal["listing"] })[]).map(({ listings, ...d }) => ({
    ...d,
    listing: listings,
  }));
}
