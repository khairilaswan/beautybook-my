"use server";

import { listingPath } from "@/lib/paths";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, loginPath } from "@/lib/auth";
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
