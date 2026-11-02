"use server";

import { updateTag } from "next/cache";
import type { FormState } from "@/app/[lang]/owner/actions";
import { requireUser } from "@/lib/auth";
import { tags } from "@/lib/data/directory";
import { revalidateLocalized } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// Profile photo, shop video and team photos. All writes go through the
// owner's session, so row-level security decides what they may change.

// Team photos sort after every shop photo, so a shop photo stays the cover.
const TEAM_SORT_BASE = 1_000_000_000;

function refresh(listingId: string, slug: string) {
  updateTag(tags.listing(slug));
  updateTag(tags.listings);
  revalidateLocalized(`/owner/${listingId}`);
}

// The profile photo is the first shop photo, which is also the cover on
// search cards. Moving it to the front is all it takes.
export async function setProfilePhoto(listingId: string, slug: string, photoId: number): Promise<FormState> {
  await requireUser(`/owner/${listingId}`);
  const supabase = await createClient();
  const { data: first } = await supabase
    .from("photos")
    .select("sort_order")
    .eq("listing_id", listingId)
    .eq("kind", "shop")
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("photos")
    .update({ sort_order: (first?.sort_order ?? 0) - 1 })
    .eq("id", photoId)
    .eq("listing_id", listingId)
    .eq("kind", "shop")
    .select("id");
  if (error || !data?.length) return { error: "Could not set the profile photo." };
  refresh(listingId, slug);
  return { message: "Profile photo set." };
}

export async function addTeamPhoto(listingId: string, slug: string, storagePath: string): Promise<FormState> {
  const user = await requireUser(`/owner/${listingId}`);
  if (!storagePath.startsWith(`${listingId}/`)) return { error: "Upload failed." };
  const supabase = await createClient();
  const { error } = await supabase.from("photos").insert({
    listing_id: listingId,
    storage_path: storagePath,
    source: "owner",
    uploaded_by: user.id,
    kind: "team",
    sort_order: TEAM_SORT_BASE + (Date.now() % 1_000_000),
  });
  if (error) return { error: "Could not add the photo." };
  refresh(listingId, slug);
  return { message: "Team photo added." };
}

// One video per shop. A new one replaces the old, and the old file is removed.
export async function saveVideo(listingId: string, slug: string, storagePath: string | null): Promise<FormState> {
  await requireUser(`/owner/${listingId}`);
  if (storagePath !== null && (!storagePath.startsWith(`${listingId}/`) || storagePath.length > 200)) {
    return { error: "Upload failed." };
  }
  const supabase = await createClient();
  const { data: before } = await supabase.from("listings").select("video_path").eq("id", listingId).maybeSingle();
  const { data, error } = await supabase
    .from("listings")
    .update({ video_path: storagePath })
    .eq("id", listingId)
    .select("id");
  if (error || !data?.length) {
    if (storagePath) await supabase.storage.from("listing-videos").remove([storagePath]);
    return { error: "Could not save the video." };
  }
  if (before?.video_path && before.video_path !== storagePath) {
    await supabase.storage.from("listing-videos").remove([before.video_path]);
  }
  refresh(listingId, slug);
  return { message: storagePath ? "Video saved." : "Video removed." };
}
