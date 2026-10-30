"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { priceLabel } from "@/lib/format";
import { formatTime } from "@/lib/hours";
import { normalizeMalaysianPhone } from "@/lib/phone";
import { clientHash, clientIp, shortCode } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { bookingMessage, whatsappLink } from "@/lib/whatsapp";

const bookingSchema = z.object({
  listingId: z.uuid(),
  // A shop service id (positive) or a standard menu item (negative template id).
  serviceId: z.coerce.number().int(),
  date: z.iso.date().optional().or(z.literal("")),
  time: z
    .string()
    .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
    .optional()
    .or(z.literal("")),
  name: z.string().trim().min(1, "Please enter your name").max(80),
  phone: z.string().trim().max(20).optional(),
  note: z.string().trim().max(300).optional(),
});

export type BookingState = { error?: string; whatsappUrl?: string };

const LIMIT_PER_HOUR = 6;

export async function createBookingRequest(_prev: BookingState, form: FormData): Promise<BookingState> {
  const parsed = bookingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const input = parsed.data;

  const ip = await clientIp();
  if (!(await verifyTurnstile(form.get("cf-turnstile-response") as string | null, ip))) {
    return { error: "Please complete the check and try again." };
  }

  const admin = createAdminClient();
  const hash = clientHash(ip);
  if (hash) {
    const { count } = await admin
      .from("booking_requests")
      .select("id", { count: "exact", head: true })
      .eq("client_hash", hash)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if ((count ?? 0) >= LIMIT_PER_HOUR) {
      return { error: "Too many requests from this connection. Please try again in an hour." };
    }
  }

  const { data: listing } = await admin
    .from("listings")
    .select("id, name, status, phone, whatsapp")
    .eq("id", input.listingId)
    .maybeSingle();
  const waNumber = listing?.whatsapp ?? (listing?.phone?.startsWith("601") ? listing.phone : null);
  if (!listing || listing.status !== "active" || !waNumber) {
    return { error: "This shop can't take WhatsApp requests right now." };
  }

  let serviceName: string;
  let servicePrice: string | null = null;
  let serviceId: number | null = null;
  if (input.serviceId > 0) {
    const { data: service } = await admin
      .from("services")
      .select("id, name, price_from, price_to")
      .eq("id", input.serviceId)
      .eq("listing_id", listing.id)
      .maybeSingle();
    if (!service) return { error: "Please choose a service." };
    serviceName = service.name;
    servicePrice = priceLabel(service);
    serviceId = service.id;
  } else {
    const { data: template } = await admin
      .from("service_templates")
      .select("name_en")
      .eq("id", -input.serviceId)
      .maybeSingle();
    if (!template) return { error: "Please choose a service." };
    serviceName = template.name_en;
  }

  const preferredAt = input.date && input.time ? new Date(`${input.date}T${input.time}:00+08:00`) : null;
  if (preferredAt && preferredAt.getTime() < Date.now() - 60 * 60 * 1000) {
    return { error: "Please pick a time in the future." };
  }
  const phone = input.phone ? normalizeMalaysianPhone(input.phone) : null;
  if (input.phone && !phone) return { error: "Please enter a Malaysian phone number." };

  const user = await getCurrentUser();
  const code = shortCode();
  const { error } = await admin.from("booking_requests").insert({
    short_code: code,
    listing_id: listing.id,
    user_id: user?.id ?? null,
    service_id: serviceId,
    service_name: serviceName,
    preferred_at: preferredAt?.toISOString() ?? null,
    customer_name: input.name,
    customer_phone: phone,
    note: input.note || null,
    client_hash: hash,
  });
  if (error) {
    console.error("booking request insert failed", error);
    return { error: "Something went wrong. Please try again." };
  }

  const preferredLabel = preferredAt
    ? `${new Intl.DateTimeFormat("en-MY", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kuala_Lumpur",
      }).format(preferredAt)}, ${formatTime(input.time!)}`
    : null;

  const text = bookingMessage({
    shopName: listing.name,
    serviceName,
    priceLabel: servicePrice,
    preferredLabel,
    customerName: input.name,
    note: input.note || null,
    shortCode: code,
  });
  return { whatsappUrl: whatsappLink(waNumber, text) };
}
