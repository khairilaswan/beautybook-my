import { supabase } from "@/lib/supabase";

// Owner screens read and write through the owner's own session, exactly like
// the website's owner dashboard: RLS only lets a shop's members change it, and
// a database trigger stops owners touching fields only staff may edit.

export type OwnerListing = {
  id: string;
  slug: string;
  name: string;
  status: string;
  description: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  price_level: number | null;
  gender: string | null;
  mall_id: number | null;
};

export async function loadOwnerListing(listingId: string, userId: string | null): Promise<OwnerListing | null> {
  if (!userId) return null;
  const { data: membership, error } = await supabase
    .from("listing_members")
    .select("role")
    .eq("listing_id", listingId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!membership) return null;
  const { data, error: listingError } = await supabase
    .from("listings")
    .select("id, slug, name, status, description, website, instagram, facebook, price_level, gender, mall_id")
    .eq("id", listingId)
    .single();
  if (listingError) throw listingError;
  return data as OwnerListing;
}

export const SAVE_FAILED = "Could not save. Please try again.";

// Booking request statuses an owner can move to, as on the website.
export const REQUEST_ACTIONS: Record<string, { status: string; label: string }[]> = {
  sent: [
    { status: "confirmed", label: "Confirm" },
    { status: "declined", label: "Decline" },
  ],
  confirmed: [
    { status: "completed", label: "Completed" },
    { status: "no_show", label: "No-show" },
  ],
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  sent: "New",
  confirmed: "Confirmed",
  declined: "Declined",
  no_show: "No-show",
  completed: "Completed",
};

export const QUOTE_ACTIONS: Record<string, { status: string; label: string }[]> = {
  sent: [
    { status: "quoted", label: "Quote sent" },
    { status: "declined", label: "Decline" },
  ],
  quoted: [
    { status: "booked", label: "Booked" },
    { status: "declined", label: "Didn't book" },
  ],
};

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  sent: "New",
  quoted: "Quote sent",
  booked: "Booked",
  declined: "Declined",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: "Wedding (nikah / sanding / reception)",
  engagement: "Engagement (tunang)",
  dinner: "Dinner or party",
  photoshoot: "Photoshoot",
  graduation: "Graduation",
  other: "Something else",
};
