"use server";

import { listingPath } from "@/lib/paths";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, loginPath } from "@/lib/auth";
import { tags } from "@/lib/data/directory";
import { reviewsTag } from "@/lib/data/reviews";
import { getActionI18n, revalidateLocalized } from "@/lib/i18n/server";
import { normalizeMalaysianPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

async function signedIn(next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(await loginPath(next));
  return user;
}

export async function toggleFavourite(listingId: string, slug: string, save: boolean) {
  const user = await signedIn(listingPath(slug));
  const supabase = await createClient();
  const { error } = save
    ? await supabase.from("favourites").upsert({ user_id: user.id, listing_id: listingId })
    : await supabase.from("favourites").delete().eq("user_id", user.id).eq("listing_id", listingId);
  if (error) throw new Error("Could not update favourites");
  revalidateLocalized("/account");
}

export async function saveNote(listingId: string, slug: string, body: string) {
  const user = await signedIn(listingPath(slug));
  const supabase = await createClient();
  const text = body.trim().slice(0, 2000);
  const { error } = text
    ? await supabase
        .from("notes")
        .upsert({ user_id: user.id, listing_id: listingId, body: text, updated_at: new Date().toISOString() })
    : await supabase.from("notes").delete().eq("user_id", user.id).eq("listing_id", listingId);
  if (error) throw new Error("Could not save your note");
  revalidateLocalized("/account");
}

const profileSchema = z.object({
  displayName: z.string().trim().max(80),
  phone: z.string().trim().max(20),
  preferredLang: z.enum(["en", "ms", "zh"]),
  remindersOptIn: z.literal("on").optional(),
  remindersShown: z.literal("1").optional(),
});

export async function updateProfile(_prev: { message?: string }, form: FormData): Promise<{ message?: string }> {
  const user = await signedIn("/account");
  const { t } = await getActionI18n();
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: t.profile.check };
  const phone = parsed.data.phone ? normalizeMalaysianPhone(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) return { message: t.common.malaysianPhone };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName || null,
      phone,
      preferred_lang: parsed.data.preferredLang,
      ...(parsed.data.remindersShown ? { reminders_opt_in: parsed.data.remindersOptIn === "on" } : {}),
    })
    .eq("id", user.id);
  if (error) return { message: t.profile.error };
  revalidateLocalized("/account");
  return { message: t.common.saved };
}

export async function recordSearch(query: string | null, category: string | null, area: string | null) {
  const user = await getCurrentUser();
  if (!user || (!query && !category && !area)) return;
  const supabase = await createClient();
  await supabase.from("search_history").insert({
    user_id: user.id,
    query: query?.slice(0, 100) ?? null,
    category_slug: category,
    area_slug: area,
  });
}

export async function clearSearchHistory() {
  const user = await signedIn("/account");
  const supabase = await createClient();
  await supabase.from("search_history").delete().eq("user_id", user.id);
  revalidateLocalized("/account");
}

const reviewSchema = z.object({
  bookingId: z.uuid(),
  rating: z.coerce.number().int().min(1, "rating").max(5),
  body: z.string().trim().max(1000),
  authorName: z.string().trim().min(1, "authorName").max(40),
});

export type ReviewState = { error?: string; done?: boolean };

// The database checks the booking is this customer's and has happened.
export async function saveReview(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  const user = await signedIn("/account");
  const { t } = await getActionI18n();
  const r = t.growth.review;
  const parsed = reviewSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    return { error: issue === "rating" ? r.pickRating : issue === "authorName" ? r.addName : r.checkReview };
  }
  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("booking_requests")
    .select("id, listing_id, service_name")
    .eq("id", parsed.data.bookingId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!booking) return { error: r.notFound };
  const { data: existing } = await supabase.from("reviews").select("id").eq("booking_request_id", booking.id).maybeSingle();
  const fields = { rating: parsed.data.rating, body: parsed.data.body || null, author_name: parsed.data.authorName };
  const { error } = existing
    ? await supabase.from("reviews").update(fields).eq("id", existing.id)
    : await supabase.from("reviews").insert({
        ...fields,
        listing_id: booking.listing_id,
        booking_request_id: booking.id,
        user_id: user.id,
        service_name: booking.service_name,
      });
  if (error) return { error: r.notYet };
  updateTag(reviewsTag(booking.listing_id));
  updateTag(tags.listings);
  revalidateLocalized("/account");
  return { done: true };
}
