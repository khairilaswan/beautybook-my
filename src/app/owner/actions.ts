"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { tags } from "@/lib/data/directory";
import { createClient } from "@/lib/supabase/server";

const STATUSES = ["confirmed", "declined", "no_show", "completed"] as const;

// RLS lets listing members update only the status column of their requests.
export async function setRequestStatus(requestId: string, status: (typeof STATUSES)[number]) {
  await requireUser("/owner");
  if (!STATUSES.includes(status)) throw new Error("Unknown status");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_requests")
    .update({ status })
    .eq("id", requestId)
    .select("id");
  if (error || !data?.length) throw new Error("You can't update this request.");
  revalidatePath("/owner", "layout");
}

const listingSchema = z.object({
  listingId: z.uuid(),
  slug: z.string(),
  description: z.string().trim().max(2000),
  website: z.url().or(z.literal("")),
  instagram: z.url().or(z.literal("")),
  facebook: z.url().or(z.literal("")),
  priceLevel: z.enum(["", "1", "2", "3", "4"]),
  gender: z.enum(["", "men", "women", "unisex"]),
});

export type FormState = { message?: string; error?: string };

// Owners edit through their own session: the database trigger rejects
// changes to fields only staff may touch (name, area, phone, status).
export async function updateListingDetails(_prev: FormState, form: FormData): Promise<FormState> {
  await requireUser("/owner");
  const parsed = listingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Please check the links are full addresses starting with https://" };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("listings")
    .update({
      description: d.description || null,
      website: d.website || null,
      instagram: d.instagram || null,
      facebook: d.facebook || null,
      price_level: d.priceLevel ? Number(d.priceLevel) : null,
      gender: d.gender || null,
    })
    .eq("id", d.listingId);
  if (error) return { error: "Could not save. Please try again." };
  const attrs = form.getAll("attributes").map(Number).filter(Number.isInteger);
  const del = await supabase.from("listing_attributes").delete().eq("listing_id", d.listingId);
  if (!del.error && attrs.length) {
    await supabase.from("listing_attributes").insert(attrs.map((attribute_id) => ({ listing_id: d.listingId, attribute_id })));
  }
  updateTag(tags.listing(d.slug));
  updateTag(tags.listings);
  return { message: "Saved." };
}

const serviceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  price_from: z.number().min(0).max(100000).nullable(),
  price_to: z.number().min(0).max(100000).nullable(),
  duration_min: z.number().int().min(5).max(1440).nullable(),
});

export async function saveServices(listingId: string, slug: string, services: unknown): Promise<FormState> {
  await requireUser("/owner");
  const parsed = z.array(serviceSchema).max(60).safeParse(services);
  if (!parsed.success) return { error: "Each service needs a name; prices must be numbers." };
  if (parsed.data.some((s) => s.price_to !== null && s.price_from !== null && s.price_to < s.price_from)) {
    return { error: "A price range ends lower than it starts." };
  }
  const supabase = await createClient();
  const del = await supabase.from("services").delete().eq("listing_id", listingId);
  if (del.error) return { error: "Could not save. Please try again." };
  if (parsed.data.length) {
    const { error } = await supabase
      .from("services")
      .insert(parsed.data.map((s, i) => ({ ...s, listing_id: listingId, sort_order: (i + 1) * 10 })));
    if (error) return { error: "Could not save. Please try again." };
  }
  updateTag(tags.listing(slug));
  updateTag(tags.listings);
  return { message: "Menu saved." };
}

const hoursSchema = z.array(
  z.object({
    weekday: z.number().int().min(0).max(6),
    opens: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
    closes: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
  }),
);

const closureSchema = z.array(
  z.object({ date_from: z.iso.date(), date_to: z.iso.date(), note: z.string().trim().max(120).nullable() }),
);

export async function saveHours(listingId: string, slug: string, hours: unknown, closures: unknown): Promise<FormState> {
  await requireUser("/owner");
  const h = hoursSchema.max(42).safeParse(hours);
  const c = closureSchema.max(30).safeParse(closures);
  if (!h.success || !c.success) return { error: "Please check the times and dates." };
  if (c.data.some((x) => x.date_to < x.date_from)) return { error: "A closure ends before it starts." };
  const supabase = await createClient();
  const [delHours, delClosures] = await Promise.all([
    supabase.from("opening_hours").delete().eq("listing_id", listingId),
    supabase.from("closures").delete().eq("listing_id", listingId),
  ]);
  if (delHours.error || delClosures.error) return { error: "Could not save. Please try again." };
  const [insHours, insClosures] = await Promise.all([
    h.data.length
      ? supabase.from("opening_hours").insert(h.data.map((x) => ({ ...x, listing_id: listingId })))
      : Promise.resolve({ error: null }),
    c.data.length
      ? supabase.from("closures").insert(c.data.map((x) => ({ ...x, listing_id: listingId })))
      : Promise.resolve({ error: null }),
  ]);
  if (insHours.error || insClosures.error) return { error: "Could not save. Please try again." };
  updateTag(tags.listing(slug));
  updateTag(tags.listings);
  return { message: "Hours saved." };
}

export async function addPhoto(listingId: string, slug: string, storagePath: string): Promise<FormState> {
  const user = await requireUser("/owner");
  if (!storagePath.startsWith(`${listingId}/`)) return { error: "Upload failed." };
  const supabase = await createClient();
  const { error } = await supabase.from("photos").insert({
    listing_id: listingId,
    storage_path: storagePath,
    source: "owner",
    uploaded_by: user.id,
    sort_order: Date.now() % 1_000_000,
  });
  if (error) return { error: "Could not add the photo." };
  updateTag(tags.listing(slug));
  updateTag(tags.listings);
  revalidatePath(`/owner/${listingId}`);
  return { message: "Photo added." };
}

export async function removePhoto(listingId: string, slug: string, photoId: number): Promise<void> {
  await requireUser("/owner");
  const supabase = await createClient();
  const { data } = await supabase.from("photos").delete().eq("id", photoId).eq("listing_id", listingId).select("storage_path");
  if (data?.[0]) await supabase.storage.from("listing-photos").remove([data[0].storage_path]);
  updateTag(tags.listing(slug));
  updateTag(tags.listings);
  revalidatePath(`/owner/${listingId}`);
}
