"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { priceLabel } from "@/lib/format";
import { localTime } from "@/lib/i18n/names";
import { getActionI18n } from "@/lib/i18n/server";
import { HTML_LANG, type Locale, fmt } from "@/lib/i18n/config";
import { malaysiaNow } from "@/lib/hours";
import { type Slot, freeSlots } from "@/lib/slots";
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
  name: z.string().trim().min(1, "name").max(80),
  phone: z.string().trim().max(20).optional(),
  note: z.string().trim().max(300).optional(),
  staffId: z.coerce.number().int().positive().optional().or(z.literal("")),
  promotionId: z.coerce.number().int().positive().optional().or(z.literal("")),
});

export type BookingState = {
  error?: string;
  whatsappUrl?: string;
  // Set when the slot was booked straight away (instant booking).
  confirmed?: { shortCode: string; when: string; shopName: string };
};

const LIMIT_PER_HOUR = 6;

export async function createBookingRequest(_prev: BookingState, form: FormData): Promise<BookingState> {
  const { locale, t } = await getActionI18n();
  const g = t.growth.booking;
  const parsed = bookingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message === "name" ? t.booking.errors.name : t.booking.errors.checkForm };
  }
  const input = parsed.data;

  const ip = await clientIp();
  if (!(await verifyTurnstile(form.get("cf-turnstile-response") as string | null, ip))) {
    return { error: t.common.completeCheck };
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
      return { error: t.booking.errors.tooMany };
    }
  }

  const { data: listing } = await admin
    .from("listings")
    .select("id, slug, name, status, phone, whatsapp")
    .eq("id", input.listingId)
    .maybeSingle();
  const waNumber = listing?.whatsapp ?? (listing?.phone?.startsWith("601") ? listing.phone : null);
  if (!listing || listing.status !== "active" || !waNumber) {
    return { error: t.booking.errors.unavailable };
  }

  let serviceName: string;
  let servicePrice: string | null = null;
  let serviceId: number | null = null;
  let duration: number | null = null;
  if (input.serviceId > 0) {
    const { data: service } = await admin
      .from("services")
      .select("id, name, price_from, price_to, duration_min")
      .eq("id", input.serviceId)
      .eq("listing_id", listing.id)
      .maybeSingle();
    if (!service) return { error: t.booking.errors.chooseService };
    serviceName = service.name;
    servicePrice = priceLabel(service, locale);
    serviceId = service.id;
    duration = service.duration_min;
  } else {
    const { data: template } = await admin
      .from("service_templates")
      .select("name_en, name_ms, duration_min")
      .eq("id", -input.serviceId)
      .maybeSingle();
    if (!template) return { error: t.booking.errors.chooseService };
    serviceName = (locale === "ms" && template.name_ms) || template.name_en;
    duration = template.duration_min;
  }

  let staff: { id: number; name: string } | null = null;
  if (input.staffId) {
    const { data } = await admin
      .from("shop_staff")
      .select("id, name")
      .eq("id", input.staffId)
      .eq("listing_id", listing.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!data) return { error: g.chooseStaff };
    staff = data;
  }
  let promotion: { id: number; title: string; price_label: string | null } | null = null;
  if (input.promotionId) {
    const { data } = await admin
      .from("promotions")
      .select("id, title, price_label, starts_on, ends_on")
      .eq("id", input.promotionId)
      .eq("listing_id", listing.id)
      .maybeSingle();
    const today = malaysiaNow().date;
    if (!data || data.starts_on > today || data.ends_on < today) return { error: g.dealEnded };
    promotion = data;
  }

  const preferredAt = input.date && input.time ? new Date(`${input.date}T${input.time}:00+08:00`) : null;
  if (preferredAt && preferredAt.getTime() < Date.now() - 60 * 60 * 1000) {
    return { error: t.booking.errors.future };
  }
  const phone = input.phone ? normalizeMalaysianPhone(input.phone) : null;
  if (input.phone && !phone) return { error: t.common.malaysianPhone };

  const user = await getCurrentUser();
  const code = shortCode();

  // Instant booking: take the slot now if it is free.
  const { data: settings } = await admin
    .from("booking_settings")
    .select("instant_enabled, slot_minutes, capacity, min_notice_hours, max_days_ahead")
    .eq("listing_id", listing.id)
    .maybeSingle();
  if (settings?.instant_enabled && preferredAt && input.date && input.time) {
    if (!phone) return { error: g.phoneNeeded };
    const slotDuration = duration ?? settings.slot_minutes;
    const free = await slotsFor(listing.id, input.date, slotDuration, staff?.id ?? null);
    if (!free.some((s) => s.time === input.time)) {
      return { error: g.slotTaken };
    }
    const { error } = await admin.rpc("book_instant", {
      p_listing_id: listing.id,
      p_start: preferredAt.toISOString(),
      p_duration: slotDuration,
      p_service_id: serviceId,
      p_service_name: serviceName,
      p_staff_id: staff?.id ?? null,
      p_staff_name: staff?.name ?? null,
      p_promotion_id: promotion?.id ?? null,
      p_user_id: user?.id ?? null,
      p_customer_name: input.name,
      p_customer_phone: phone,
      p_note: input.note || null,
      p_client_hash: hash,
      p_short_code: code,
    });
    if (error) {
      if (error.message.includes("slot_full")) return { error: g.slotTaken };
      console.error("instant booking failed", error);
      return { error: t.common.tryAgain };
    }
    await admin.rpc("track_listing_event", { p_listing_id: listing.id, p_kind: "request" });
    const when = whenLabel(preferredAt, input.time, locale);
    const text = bookingMessage({
      shopName: listing.name,
      serviceName,
      priceLabel: promotion?.price_label ?? servicePrice,
      preferredLabel: when,
      customerName: input.name,
      note: [staff ? fmt(g.withStaff, { name: staff.name }) : null, promotion ? fmt(g.dealNote, { deal: promotion.title }) : null, input.note || null]
        .filter(Boolean)
        .join(". ") || null,
      shortCode: code,
      confirmed: true,
      words: t.booking.message,
    });
    return {
      confirmed: { shortCode: code, when, shopName: listing.name },
      whatsappUrl: whatsappLink(waNumber, text),
    };
  }

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
    staff_id: staff?.id ?? null,
    staff_name: staff?.name ?? null,
    promotion_id: promotion?.id ?? null,
    duration_min: duration,
  });
  if (error) {
    console.error("booking request insert failed", error);
    return { error: t.common.tryAgain };
  }

  await admin.rpc("track_listing_event", { p_listing_id: listing.id, p_kind: "request" });
  const preferredLabel = preferredAt ? whenLabel(preferredAt, input.time!, locale) : null;

  const text = bookingMessage({
    shopName: listing.name,
    serviceName,
    priceLabel: promotion?.price_label ?? servicePrice,
    preferredLabel,
    customerName: input.name,
    note: [staff ? fmt(g.withStaff, { name: staff.name }) : null, promotion ? fmt(g.dealNote, { deal: promotion.title }) : null, input.note || null]
      .filter(Boolean)
      .join(". ") || null,
    shortCode: code,
    words: t.booking.message,
  });
  return { whatsappUrl: whatsappLink(waNumber, text) };
}

function whenLabel(at: Date, time: string, locale: Locale): string {
  return `${new Intl.DateTimeFormat(HTML_LANG[locale], {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(at)}, ${localTime(time, locale)}`;
}

// Free times for instant booking on one day, checked again when booking.
async function slotsFor(listingId: string, date: string, duration: number, staffId: number | null): Promise<Slot[]> {
  const admin = createAdminClient();
  const dayStart = new Date(`${date}T00:00:00+08:00`);
  const [settings, hours, closures, taken] = await Promise.all([
    admin
      .from("booking_settings")
      .select("instant_enabled, slot_minutes, capacity, min_notice_hours, max_days_ahead")
      .eq("listing_id", listingId)
      .maybeSingle(),
    admin.from("opening_hours").select("weekday, opens, closes").eq("listing_id", listingId),
    admin.from("closures").select("date_from, date_to, note").eq("listing_id", listingId),
    admin
      .from("booking_requests")
      .select("preferred_at, duration_min, staff_id")
      .eq("listing_id", listingId)
      .eq("instant", true)
      .in("status", ["confirmed", "completed"])
      .gte("preferred_at", new Date(dayStart.getTime() - 86_400_000).toISOString())
      .lt("preferred_at", new Date(dayStart.getTime() + 86_400_000).toISOString()),
  ]);
  const s = settings.data;
  if (!s?.instant_enabled) return [];
  const today = malaysiaNow().date;
  const last = new Date(new Date(`${today}T12:00:00+08:00`).getTime() + s.max_days_ahead * 86_400_000)
    .toISOString()
    .slice(0, 10);
  if (date < today || date > last) return [];
  return freeSlots({
    date,
    weekday: new Date(`${date}T12:00:00+08:00`).getUTCDay(),
    hours: hours.data ?? [],
    closures: closures.data ?? [],
    settings: s,
    duration,
    taken: (taken.data ?? []).map((b) => ({ start: b.preferred_at!, duration_min: b.duration_min, staff_id: b.staff_id })),
    staffId,
    nowMs: Date.now(),
  });
}

const availabilitySchema = z.object({
  listingId: z.uuid(),
  date: z.iso.date(),
  serviceId: z.number().int(),
  staffId: z.number().int().positive().nullable(),
});

// For the booking form: which times are still free on a day.
export async function getAvailability(input: z.input<typeof availabilitySchema>): Promise<Slot[]> {
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return [];
  const { listingId, date, serviceId, staffId } = parsed.data;
  const admin = createAdminClient();
  let duration: number | null = null;
  if (serviceId > 0) {
    const { data } = await admin.from("services").select("duration_min").eq("id", serviceId).eq("listing_id", listingId).maybeSingle();
    duration = data?.duration_min ?? null;
  } else if (serviceId < 0) {
    const { data } = await admin.from("service_templates").select("duration_min").eq("id", -serviceId).maybeSingle();
    duration = data?.duration_min ?? null;
  }
  const { data: s } = await admin.from("booking_settings").select("slot_minutes").eq("listing_id", listingId).maybeSingle();
  return slotsFor(listingId, date, duration ?? s?.slot_minutes ?? 30, staffId);
}
