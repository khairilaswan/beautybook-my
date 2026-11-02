import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { tags } from "@/lib/data/directory";
import { reviewsTag } from "@/lib/data/reviews";
import { jsonBody, jsonError, mobileContext } from "@/lib/mobile-api";
import { createAdminClient } from "@/lib/supabase/admin";

// The app saves owner edits and reviews straight to Supabase (RLS checks
// them). This refreshes the website's cached copy afterwards, the way the
// website's own server actions do with updateTag.
export async function POST(request: NextRequest) {
  const ctx = await mobileContext(request);
  if (ctx instanceof NextResponse) return ctx;
  const body = await jsonBody(request);
  const listingId = typeof body.listingId === "string" ? body.listingId : "";
  const scope = body.scope === "reviews" ? "reviews" : "listing";
  if (!/^[0-9a-f-]{36}$/i.test(listingId)) return jsonError(ctx.t.common.tryAgain, 400);

  const admin = createAdminClient();
  const userId = ctx.user!.id;
  // Only the shop's own members refresh its page. Reviews: the shop's members
  // (an owner reply) or someone who reviewed the shop.
  const member = await admin
    .from("listing_members")
    .select("listing_id")
    .eq("listing_id", listingId)
    .eq("user_id", userId)
    .maybeSingle();
  const allowed =
    !!member.data ||
    (scope === "reviews" &&
      !!(await admin.from("reviews").select("id").eq("listing_id", listingId).eq("user_id", userId).limit(1).maybeSingle()).data);
  if (!allowed) return jsonError(ctx.t.common.tryAgain, 403);

  const { data: listing } = await admin.from("listings").select("slug").eq("id", listingId).maybeSingle();
  if (!listing) return jsonError(ctx.t.common.tryAgain, 404);

  const now = { expire: 0 };
  if (scope === "reviews") revalidateTag(reviewsTag(listingId), now);
  revalidateTag(tags.listing(listing.slug), now);
  revalidateTag(tags.listings, now);
  return new NextResponse(null, { status: 204 });
}
