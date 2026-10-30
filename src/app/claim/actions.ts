"use server";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { tags } from "@/lib/data/directory";
import { maskPhone, normalizeMalaysianPhone } from "@/lib/phone";
import { clientIp } from "@/lib/request";
import { listingSlug, uniqueSlug } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendWhatsAppCode } from "@/lib/whatsapp-cloud";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_CLAIMS_PER_HOUR = 5;
const RESEND_AFTER_MS = 60 * 1000;

export type ClaimState = {
  error?: string;
  claimId?: number;
  sentTo?: string;
  done?: boolean;
};

function hashCode(claimId: number, code: string): string {
  return createHash("sha256").update(`${claimId}:${code}`).digest("hex");
}

async function signedIn(next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

// Sends a code to the phone number already on the listing. Whoever can read
// that WhatsApp controls the shop's number, which is our proof of ownership.
async function sendClaimCode(listingId: string, userId: string): Promise<ClaimState> {
  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, slug, status, phone, whatsapp")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || listing.status === "archived") return { error: "This listing can't be claimed." };
  const to = listing.whatsapp ?? listing.phone;
  if (!to || !to.startsWith("601")) {
    return { error: "This listing has no mobile number to send a code to. Please use the document option below." };
  }

  const { count: members } = await admin
    .from("listing_members")
    .select("user_id", { count: "exact", head: true })
    .eq("listing_id", listing.id);
  if ((members ?? 0) > 0) {
    return { error: "This business is already managed by its owner. If that's wrong, use the document option below." };
  }

  const { count: recentClaims } = await admin
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if ((recentClaims ?? 0) >= MAX_CLAIMS_PER_HOUR) {
    return { error: "Too many claims started. Please try again in an hour." };
  }

  let { data: claim } = await admin
    .from("claims")
    .select("id")
    .eq("listing_id", listing.id)
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("method", "otp")
    .maybeSingle();
  if (!claim) {
    const inserted = await admin
      .from("claims")
      .insert({ listing_id: listing.id, user_id: userId, method: "otp" })
      .select("id")
      .single();
    if (inserted.error) return { error: "Could not start the claim. Please try again." };
    claim = inserted.data;
  } else {
    const { data: previous } = await admin
      .from("claim_codes")
      .select("created_at")
      .eq("claim_id", claim.id)
      .maybeSingle();
    if (previous && Date.now() - new Date(previous.created_at).getTime() < RESEND_AFTER_MS) {
      return { error: "A code was just sent. Please wait a minute before asking for another." };
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await admin.from("claim_codes").upsert({
    claim_id: claim.id,
    code_hash: hashCode(claim.id, code),
    phone: to,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    attempts: 0,
    created_at: new Date().toISOString(),
  });
  if (error) return { error: "Could not start the claim. Please try again." };

  try {
    await sendWhatsAppCode(to, code);
  } catch (e) {
    console.error("claim code send failed", e);
    return { error: "We couldn't send the WhatsApp code. Please try again, or use the document option below." };
  }
  return { claimId: claim.id, sentTo: maskPhone(to) };
}

export async function startClaim(_prev: ClaimState, form: FormData): Promise<ClaimState> {
  const listingId = z.uuid().safeParse(form.get("listingId"));
  const slug = String(form.get("slug") ?? "");
  const user = await signedIn(`/claim/${slug}`);
  if (!listingId.success) return { error: "Unknown listing." };
  return sendClaimCode(listingId.data, user.id);
}

export async function verifyClaim(prev: ClaimState, form: FormData): Promise<ClaimState> {
  const slug = String(form.get("slug") ?? "");
  const user = await signedIn(`/claim/${slug}`);
  const code = String(form.get("code") ?? "").trim();
  if (!prev.claimId || !/^[0-9]{6}$/.test(code)) return { ...prev, error: "Enter the 6-digit code." };

  const admin = createAdminClient();
  const { data: claim } = await admin
    .from("claims")
    .select("id, listing_id, user_id, status")
    .eq("id", prev.claimId)
    .maybeSingle();
  if (!claim || claim.user_id !== user.id || claim.status !== "pending") {
    return { error: "This claim is no longer open. Please start again." };
  }
  const { data: stored } = await admin
    .from("claim_codes")
    .select("code_hash, expires_at, attempts")
    .eq("claim_id", claim.id)
    .maybeSingle();
  if (!stored || new Date(stored.expires_at).getTime() < Date.now()) {
    return { ...prev, error: "That code has expired. Request a new one." };
  }
  if (stored.attempts >= MAX_ATTEMPTS) {
    return { ...prev, error: "Too many wrong codes. Request a new one." };
  }
  const expected = Buffer.from(stored.code_hash, "hex");
  const actual = Buffer.from(hashCode(claim.id, code), "hex");
  if (!timingSafeEqual(expected, actual)) {
    await admin.from("claim_codes").update({ attempts: stored.attempts + 1 }).eq("claim_id", claim.id);
    return { ...prev, error: "That code is not right. Check WhatsApp and try again." };
  }

  // Approve: the claimant becomes the owner and the number counts as verified.
  const { data: listing } = await admin
    .from("listings")
    .select("id, slug, status, source")
    .eq("id", claim.listing_id)
    .single();
  const { error: memberError } = await admin
    .from("listing_members")
    .insert({ listing_id: claim.listing_id, user_id: user.id, role: "owner" });
  if (memberError && memberError.code !== "23505") {
    return { ...prev, error: "Could not finish the claim. Please try again." };
  }
  await Promise.all([
    admin
      .from("claims")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", claim.id),
    admin.from("claim_codes").delete().eq("claim_id", claim.id),
    admin
      .from("listings")
      .update({
        phone_verified_at: new Date().toISOString(),
        // A business added by its owner goes live once the number is verified.
        ...(listing?.status === "hidden" && listing.source === "owner" ? { status: "active" } : {}),
      })
      .eq("id", claim.listing_id),
    // Other people's pending claims on this listing can't succeed any more.
    admin
      .from("claims")
      .update({ status: "expired" })
      .eq("listing_id", claim.listing_id)
      .eq("status", "pending")
      .neq("id", claim.id),
  ]);
  if (listing) {
    updateTag(tags.listing(listing.slug));
    updateTag(tags.listings);
  }
  redirect(`/owner/${claim.listing_id}?welcome=1`);
}

const documentSchema = z.object({
  listingId: z.uuid(),
  slug: z.string(),
  // Uploaded by the browser straight to Storage (claim-evidence/<user id>/...).
  evidencePath: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/),
  note: z.string().trim().max(1000).optional(),
});

export async function submitDocumentClaim(_prev: ClaimState, form: FormData): Promise<ClaimState> {
  const parsed = documentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Please attach your SSM certificate or a shopfront photo." };
  const user = await signedIn(`/claim/${parsed.data.slug}`);
  if (!parsed.data.evidencePath.startsWith(`${user.id}/`)) return { error: "Please upload the file again." };

  const admin = createAdminClient();
  const { error } = await admin.from("claims").insert({
    listing_id: parsed.data.listingId,
    user_id: user.id,
    method: "document",
    evidence_path: parsed.data.evidencePath,
    note: parsed.data.note || null,
  });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "You already have a claim waiting for review on this listing."
          : "Could not submit the claim. Please try again.",
    };
  }
  return { done: true };
}

const newBusinessSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().min(1),
  area: z.string().min(1),
  phone: z.string().trim().min(8).max(20),
  address: z.string().trim().max(300).optional(),
});

// "Add my business": creates a hidden listing and sends a code to its number.
// Verifying the code makes the listing live with the user as owner.
export async function addBusiness(_prev: ClaimState & { listingId?: string; slug?: string }, form: FormData) {
  const user = await signedIn("/for-business");
  if (!(await verifyTurnstile(form.get("cf-turnstile-response") as string | null, await clientIp()))) {
    return { error: "Please complete the check and try again." };
  }
  const parsed = newBusinessSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Please fill in the name, service, area and mobile number." };
  const phone = normalizeMalaysianPhone(parsed.data.phone);
  if (!phone || !phone.startsWith("601")) return { error: "Please enter the shop's Malaysian mobile (WhatsApp) number." };

  const admin = createAdminClient();
  const [{ data: area }, { data: category }, { data: existing }] = await Promise.all([
    admin.from("areas").select("id, slug").eq("slug", parsed.data.area).maybeSingle(),
    admin.from("categories").select("id").eq("slug", parsed.data.category).maybeSingle(),
    admin.from("listings").select("slug, name").or(`phone.eq.${phone},whatsapp.eq.${phone}`).limit(1),
  ]);
  if (!area || !category) return { error: "Please choose a service and an area." };
  if (existing && existing.length > 0) {
    redirect(`/claim/${existing[0].slug}?existing=1`);
  }

  const slug = await uniqueSlug(listingSlug(parsed.data.name, area.slug), async (candidates) => {
    const { data } = await admin.from("listings").select("slug").in("slug", candidates);
    return (data ?? []).map((r) => r.slug);
  });
  const { data: listing, error } = await admin
    .from("listings")
    .insert({
      slug,
      name: parsed.data.name,
      status: "hidden",
      area_id: area.id,
      address: parsed.data.address || null,
      phone,
      whatsapp: phone,
      source: "owner",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: "Could not add the business. Please try again." };
  await admin.from("listing_categories").insert({ listing_id: listing.id, category_id: category.id, is_primary: true });

  const sent = await sendClaimCode(listing.id, user.id);
  return { ...sent, listingId: listing.id, slug };
}
