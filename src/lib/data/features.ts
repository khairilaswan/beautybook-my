import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

export const FEATURES_TAG = "site-features";

export type FeatureSettings = {
  // Star ratings and written reviews, from verified bookings only.
  reviewsEnabled: boolean;
  // Points each side of a referral earns when the friend's first visit is done.
  referralPoints: number;
  // Price of 30 days of featured placement in one area.
  featuredPriceRm: number;
};

const FALLBACK: FeatureSettings = { reviewsEnabled: false, referralPoints: 100, featuredPriceRm: 99 };

// Switches the platform owner sets in /admin/features. A failed read (for
// example before the migration has run) falls back to everything off.
export async function getFeatureSettings(): Promise<FeatureSettings> {
  "use cache";
  cacheLife("days");
  cacheTag(FEATURES_TAG);
  try {
    const { data, error } = await createPublicClient()
      .from("site_settings")
      .select("reviews_enabled, referral_points, featured_price_rm")
      .maybeSingle();
    if (error || !data) return FALLBACK;
    return {
      reviewsEnabled: !!data.reviews_enabled,
      referralPoints: data.referral_points,
      featuredPriceRm: data.featured_price_rm,
    };
  } catch {
    return FALLBACK;
  }
}
