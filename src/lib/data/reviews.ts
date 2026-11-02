import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

export const reviewsTag = (listingId: string) => `reviews:${listingId}`;

export type Review = {
  id: number;
  author_name: string;
  rating: number;
  body: string | null;
  service_name: string | null;
  owner_reply: string | null;
  created_at: string;
};

export type RatingSummary = { average: number | null; count: number };

export async function getReviews(listingId: string): Promise<{ reviews: Review[]; summary: RatingSummary }> {
  "use cache";
  cacheLife("hours");
  cacheTag(reviewsTag(listingId));
  const { data, error } = await createPublicClient()
    .from("reviews")
    .select("id, author_name, rating, body, service_name, owner_reply, created_at")
    .eq("listing_id", listingId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { reviews: [], summary: { average: null, count: 0 } };
  const reviews = data as Review[];
  const count = reviews.length;
  const average = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : null;
  return { reviews, summary: { average, count } };
}

export async function getRatingSummary(listingId: string): Promise<RatingSummary> {
  return (await getReviews(listingId)).summary;
}
