"use server";

import { updateTag } from "next/cache";
import { localizedPath, revalidateLocalized } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/[lang]/owner/actions";
import { requireUser } from "@/lib/auth";
import { tags } from "@/lib/data/directory";
import { getFeatureSettings } from "@/lib/data/features";
import { reviewsTag } from "@/lib/data/reviews";
import { OCCASIONS, PACKAGE_KINDS } from "@/lib/types";
import { startCheckout } from "@/lib/payments";
import { paymentsEnabled } from "@/lib/setup";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Owner tools added with the growth features. Each one writes through the
// owner's own session, so row-level security decides what they may change.

const FAILED = { error: "Could not save. Please try again." } as const;

function refresh(listingId: string, slug: string) {
  updateTag(tags.listing(slug));
  updateTag(tags.listings);
  revalidateLocalized(`/owner/${listingId}`);
}

// Rejects anyone who isn't a member of the listing before the admin client is used.
async function requireMember(listingId: string) {
  const user = await requireUser(`/owner/${listingId}`);
  const supabase = await createClient();
  const { data } = await supabase
    .from("listing_members")
    .select("listing_id")
    .eq("listing_id", listingId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) throw new Error("Not a member of this listing");
  return { user, supabase };
}

// ---------------------------------------------------------------------------
// Areas a home-service vendor travels to
// ---------------------------------------------------------------------------

export async function saveServiceAreas(listingId: string, slug: string, areaIds: number[]): Promise<FormState> {
  const { supabase } = await requireMember(listingId);
  const ids = [...new Set(areaIds.filter(Number.isInteger))].slice(0, 40);
  const del = await supabase.from("listing_service_areas").delete().eq("listing_id", listingId);
  if (del.error) return FAILED;
  if (ids.length) {
    const { error } = await supabase
      .from("listing_service_areas")
      .insert(ids.map((area_id) => ({ listing_id: listingId, area_id })));
    if (error) return FAILED;
  }
  refresh(listingId, slug);
  return { message: ids.length ? "Saved." : "Saved. You're not listed as travelling anywhere." };
}

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

export async function addPortfolioPhoto(
  listingId: string,
  slug: string,
  storagePath: string,
  categoryId: number | null,
  caption: string,
): Promise<FormState> {
  const { user, supabase } = await requireMember(listingId);
  if (!storagePath.startsWith(`${listingId}/`)) return { error: "Upload failed." };
  const { error } = await supabase.from("photos").insert({
    listing_id: listingId,
    storage_path: storagePath,
    source: "owner",
    uploaded_by: user.id,
    kind: "portfolio",
    category_id: categoryId,
    caption: caption.trim().slice(0, 140) || null,
    sort_order: Date.now() % 1_000_000,
  });
  if (error) return { error: "Could not add the photo." };
  refresh(listingId, slug);
  return { message: "Added to your portfolio." };
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

const staffSchema = z.array(
  z.object({
    id: z.number().int().positive().nullable(),
    name: z.string().trim().min(1).max(60),
    title: z.string().trim().max(60),
    bio: z.string().trim().max(500),
    photo_path: z.string().max(200).nullable(),
    languages: z.array(z.string().trim().min(1).max(20)).max(6),
  }),
).max(40);

export async function saveStaff(listingId: string, slug: string, rows: unknown): Promise<FormState> {
  const { supabase } = await requireMember(listingId);
  const parsed = staffSchema.safeParse(rows);
  if (!parsed.success) return { error: "Each person needs a name." };
  if (parsed.data.some((r) => r.photo_path && !r.photo_path.startsWith(`${listingId}/`))) return { error: "Upload failed." };
  const { data: existing } = await supabase.from("shop_staff").select("id").eq("listing_id", listingId);
  const keep = new Set(parsed.data.map((r) => r.id).filter((id) => id !== null));
  const removed = (existing ?? []).map((r) => r.id).filter((id) => !keep.has(id));
  if (removed.length) {
    const { error } = await supabase.from("shop_staff").delete().in("id", removed).eq("listing_id", listingId);
    if (error) return FAILED;
  }
  for (const [i, r] of parsed.data.entries()) {
    const row = {
      listing_id: listingId,
      name: r.name,
      title: r.title || null,
      bio: r.bio || null,
      photo_path: r.photo_path,
      languages: r.languages,
      sort_order: (i + 1) * 10,
    };
    const { error } = r.id
      ? await supabase.from("shop_staff").update(row).eq("id", r.id).eq("listing_id", listingId)
      : await supabase.from("shop_staff").insert(row);
    if (error) return FAILED;
  }
  refresh(listingId, slug);
  return { message: "Team saved." };
}

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

const promotionSchema = z
  .object({
    title: z.string().trim().min(1, "Give the deal a title").max(80),
    details: z.string().trim().max(500),
    price_label: z.string().trim().max(40),
    occasion: z.enum(OCCASIONS),
    starts_on: z.iso.date(),
    ends_on: z.iso.date(),
  })
  .refine((p) => p.ends_on >= p.starts_on, { message: "The deal ends before it starts." });

export async function addPromotion(listingId: string, slug: string, input: unknown): Promise<FormState> {
  const { supabase } = await requireMember(listingId);
  const parsed = promotionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the deal." };
  const p = parsed.data;
  const { error } = await supabase.from("promotions").insert({
    listing_id: listingId,
    title: p.title,
    details: p.details || null,
    price_label: p.price_label || null,
    occasion: p.occasion,
    starts_on: p.starts_on,
    ends_on: p.ends_on,
  });
  if (error) return FAILED;
  refresh(listingId, slug);
  return { message: "Deal added." };
}

export async function removePromotion(listingId: string, slug: string, id: number): Promise<void> {
  const { supabase } = await requireMember(listingId);
  await supabase.from("promotions").delete().eq("id", id).eq("listing_id", listingId);
  refresh(listingId, slug);
}

// ---------------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------------

const packagesSchema = z
  .array(
    z.object({
      kind: z.enum(PACKAGE_KINDS),
      name: z.string().trim().min(1).max(80),
      description: z.string().trim().max(1000),
      includes: z.array(z.string().trim().min(1).max(80)).max(15),
      price_from: z.number().min(0).max(1_000_000).nullable(),
      price_to: z.number().min(0).max(1_000_000).nullable(),
    }),
  )
  .max(20);

export async function savePackages(listingId: string, slug: string, rows: unknown): Promise<FormState> {
  const { supabase } = await requireMember(listingId);
  const parsed = packagesSchema.safeParse(rows);
  if (!parsed.success) return { error: "Each package needs a name; prices must be numbers." };
  if (parsed.data.some((p) => p.price_from !== null && p.price_to !== null && p.price_to < p.price_from)) {
    return { error: "A price range ends lower than it starts." };
  }
  // Quote requests keep the package name, so replacing the rows is safe.
  const del = await supabase.from("packages").delete().eq("listing_id", listingId);
  if (del.error) return FAILED;
  if (parsed.data.length) {
    const { error } = await supabase.from("packages").insert(
      parsed.data.map((p, i) => ({
        ...p,
        description: p.description || null,
        listing_id: listingId,
        sort_order: (i + 1) * 10,
      })),
    );
    if (error) return FAILED;
  }
  refresh(listingId, slug);
  return { message: "Packages saved." };
}

const QUOTE_STATUSES = ["quoted", "booked", "declined"] as const;

export async function setQuoteStatus(listingId: string, quoteId: string, status: (typeof QUOTE_STATUSES)[number]) {
  const { supabase } = await requireMember(listingId);
  if (!QUOTE_STATUSES.includes(status)) throw new Error("Unknown status");
  await supabase.from("quote_requests").update({ status }).eq("id", quoteId).eq("listing_id", listingId);
  revalidateLocalized(`/owner/${listingId}`);
}

// ---------------------------------------------------------------------------
// Instant booking
// ---------------------------------------------------------------------------

const bookingSettingsSchema = z.object({
  instant_enabled: z.boolean(),
  slot_minutes: z.number().refine((n) => [15, 30, 45, 60, 90, 120].includes(n)),
  capacity: z.number().int().min(1).max(50),
  min_notice_hours: z.number().int().min(0).max(72),
  max_days_ahead: z.number().int().min(1).max(60),
});

export async function saveBookingSettings(listingId: string, slug: string, input: unknown): Promise<FormState> {
  const { supabase } = await requireMember(listingId);
  const parsed = bookingSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: "Please check the numbers." };
  if (parsed.data.instant_enabled) {
    const { count } = await supabase
      .from("opening_hours")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId);
    if (!count) return { error: "Add your opening hours first, so customers only see times you're open." };
  }
  const { error } = await supabase.from("booking_settings").upsert({ listing_id: listingId, ...parsed.data });
  if (error) return FAILED;
  refresh(listingId, slug);
  return { message: parsed.data.instant_enabled ? "Instant booking is on." : "Saved. Customers send requests on WhatsApp." };
}

// ---------------------------------------------------------------------------
// Reviews: the shop's public reply
// ---------------------------------------------------------------------------

export async function replyToReview(listingId: string, reviewId: number, reply: string): Promise<FormState> {
  const { supabase } = await requireMember(listingId);
  const text = reply.trim().slice(0, 1000);
  const { data, error } = await supabase
    .from("reviews")
    .update({ owner_reply: text || null, owner_replied_at: text ? new Date().toISOString() : null })
    .eq("id", reviewId)
    .eq("listing_id", listingId)
    .select("id");
  if (error || !data?.length) return FAILED;
  updateTag(reviewsTag(listingId));
  revalidateLocalized(`/owner/${listingId}`);
  return { message: text ? "Reply posted." : "Reply removed." };
}

// ---------------------------------------------------------------------------
// Loyalty stamp card
// ---------------------------------------------------------------------------

const loyaltySchema = z.object({
  enabled: z.boolean(),
  stamps_required: z.number().int().min(2).max(20),
  reward: z.string().trim().min(1, "Say what the reward is").max(80),
});

export async function saveLoyalty(listingId: string, slug: string, input: unknown): Promise<FormState> {
  const { supabase } = await requireMember(listingId);
  const parsed = loyaltySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the card." };
  const { error } = await supabase.from("loyalty_programs").upsert({ listing_id: listingId, ...parsed.data });
  if (error) return FAILED;
  refresh(listingId, slug);
  return { message: parsed.data.enabled ? "Stamp card is on." : "Stamp card is off." };
}

export type CardLookup = FormState & { customer?: { userId: string; name: string; stamps: number } };

// Owners look a customer up by the code on the customer's card.
export async function lookupCard(listingId: string, code: string): Promise<CardLookup> {
  await requireMember(listingId);
  const clean = code.trim().toUpperCase();
  if (!/^[0-9A-F]{8}$/.test(clean)) return { error: "Codes are 8 letters and numbers." };
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id, display_name").eq("referral_code", clean).maybeSingle();
  if (!profile) return { error: "No customer has that code." };
  const { data: stamps } = await admin.rpc("loyalty_balance", { p_listing_id: listingId, p_user_id: profile.id });
  return { customer: { userId: profile.id, name: profile.display_name ?? "Customer", stamps: Number(stamps ?? 0) } };
}

export async function redeemLoyalty(listingId: string, customerId: string): Promise<FormState> {
  const { user, supabase } = await requireMember(listingId);
  const { data: program } = await supabase
    .from("loyalty_programs")
    .select("stamps_required, reward")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (!program) return { error: "Turn on your stamp card first." };
  // The insert policy checks the customer has enough stamps.
  const { error } = await supabase.from("loyalty_redemptions").insert({
    listing_id: listingId,
    user_id: customerId,
    stamps_used: program.stamps_required,
    reward: program.reward,
    redeemed_by: user.id,
  });
  if (error) return { error: "This card doesn't have enough stamps yet." };
  revalidateLocalized(`/owner/${listingId}`);
  return { message: `Reward given: ${program.reward}.` };
}

// ---------------------------------------------------------------------------
// Gift vouchers
// ---------------------------------------------------------------------------

const voucherSettingsSchema = z.object({
  enabled: z.boolean(),
  amounts: z.array(z.number().int().min(10).max(5000)).min(1).max(6),
  valid_months: z.number().int().min(1).max(24),
  terms: z.string().trim().max(500),
});

export async function saveVoucherSettings(listingId: string, slug: string, input: unknown): Promise<FormState> {
  const { supabase } = await requireMember(listingId);
  const parsed = voucherSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: "Amounts must be between RM10 and RM5,000." };
  const { error } = await supabase.from("voucher_settings").upsert({
    listing_id: listingId,
    ...parsed.data,
    amounts: [...new Set(parsed.data.amounts)].sort((a, b) => a - b),
    terms: parsed.data.terms || null,
  });
  if (error) return FAILED;
  refresh(listingId, slug);
  return { message: "Saved." };
}

export async function redeemVoucher(listingId: string, code: string): Promise<FormState> {
  const { user, supabase } = await requireMember(listingId);
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const { data: voucher } = await supabase
    .from("gift_vouchers")
    .select("id, amount_rm, status, expires_at, recipient_name")
    .eq("listing_id", listingId)
    .eq("code", clean)
    .maybeSingle();
  if (!voucher) return { error: "No voucher for your shop has that code." };
  if (voucher.status === "redeemed") return { error: "This voucher was already used." };
  if (voucher.status !== "active") return { error: "This voucher hasn't been paid for." };
  if (new Date(voucher.expires_at).getTime() < Date.now()) return { error: "This voucher has expired." };
  const { data, error } = await supabase
    .from("gift_vouchers")
    .update({ status: "redeemed", redeemed_at: new Date().toISOString(), redeemed_by: user.id })
    .eq("id", voucher.id)
    .eq("status", "active")
    .select("id");
  if (error || !data?.length) return FAILED;
  revalidateLocalized(`/owner/${listingId}`);
  return { message: `RM${voucher.amount_rm} voucher for ${voucher.recipient_name} used. Take it off their bill.` };
}

// ---------------------------------------------------------------------------
// Featured placement
// ---------------------------------------------------------------------------

const featuredSchema = z.object({
  areaId: z.number().int().positive().nullable(),
  categoryId: z.number().int().positive().nullable(),
  note: z.string().trim().max(300),
});

// With payments set up the owner pays by card or FPX and goes live at once;
// otherwise the request waits in /admin/featured for BeautyBook to arrange.
export async function requestFeatured(listingId: string, input: unknown): Promise<FormState> {
  const { user } = await requireMember(listingId);
  const parsed = featuredSchema.safeParse(input);
  if (!parsed.success) return { error: "Please pick an area." };
  const { featuredPriceRm } = await getFeatureSettings();
  const admin = createAdminClient();
  const now = Date.now();
  const pay = paymentsEnabled();
  const { data: placement, error } = await admin
    .from("featured_placements")
    .insert({
      listing_id: listingId,
      area_id: parsed.data.areaId,
      category_id: parsed.data.categoryId,
      starts_at: new Date(now).toISOString(),
      ends_at: new Date(now + 30 * 86_400_000).toISOString(),
      status: pay ? "pending_payment" : "requested",
      amount_rm: featuredPriceRm,
      requested_by: user.id,
      note: parsed.data.note || null,
    })
    .select("id")
    .single();
  if (error) return FAILED;
  if (!pay) {
    revalidateLocalized(`/owner/${listingId}`);
    return { message: "Request sent. We'll WhatsApp you to arrange it." };
  }
  const url = await startCheckout({
    kind: "featured",
    refId: String(placement.id),
    userId: user.id,
    amountRm: featuredPriceRm,
    description: "BeautyBook featured placement, 30 days",
    successPath: await localizedPath(`/owner/${listingId}?tab=grow&paid=featured`),
    cancelPath: await localizedPath(`/owner/${listingId}?tab=grow`),
    email: user.email,
  });
  redirect(url);
}
