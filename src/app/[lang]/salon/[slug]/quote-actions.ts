"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, priceRangeLabel } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getActionI18n } from "@/lib/i18n/server";
import { EVENT_TYPES } from "@/lib/labels";
import { normalizeMalaysianPhone } from "@/lib/phone";
import { clientHash, clientIp, shortCode } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { siteUrl } from "@/lib/env";
import { whatsappLink } from "@/lib/whatsapp";

const quoteSchema = z.object({
  listingId: z.uuid(),
  packageId: z.coerce.number().int().positive().optional().or(z.literal("")),
  eventType: z.enum(EVENT_TYPES),
  eventDate: z.iso.date().optional().or(z.literal("")),
  people: z.coerce.number().int().min(1).max(500).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional(),
  budget: z.string().trim().max(40).optional(),
  name: z.string().trim().min(1, "name").max(80),
  phone: z.string().trim().min(1, "phone").max(20),
  note: z.string().trim().max(500).optional(),
});

export type QuoteState = { error?: string; whatsappUrl?: string };

const LIMIT_PER_HOUR = 4;

// Bridal and event quotes: saved for the shop's inbox, then sent from the
// customer's own WhatsApp like a booking request.
export async function requestQuote(_prev: QuoteState, form: FormData): Promise<QuoteState> {
  const { locale, t } = await getActionI18n();
  const g = t.growth.quote;
  const parsed = quoteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    return { error: issue === "name" ? t.booking.errors.name : issue === "phone" ? t.common.malaysianPhone : t.booking.errors.checkForm };
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
      .from("quote_requests")
      .select("id", { count: "exact", head: true })
      .eq("client_hash", hash)
      .gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
    if ((count ?? 0) >= LIMIT_PER_HOUR) return { error: t.booking.errors.tooMany };
  }

  const { data: listing } = await admin
    .from("listings")
    .select("id, name, status, phone, whatsapp")
    .eq("id", input.listingId)
    .maybeSingle();
  const waNumber = listing?.whatsapp ?? (listing?.phone?.startsWith("601") ? listing.phone : null);
  if (!listing || listing.status !== "active" || !waNumber) return { error: t.booking.errors.unavailable };

  let pkg: { id: number; name: string; price_from: number | null; price_to: number | null } | null = null;
  if (input.packageId) {
    const { data } = await admin
      .from("packages")
      .select("id, name, price_from, price_to")
      .eq("id", input.packageId)
      .eq("listing_id", listing.id)
      .maybeSingle();
    if (!data) return { error: g.choosePackage };
    pkg = data;
  }
  const phone = normalizeMalaysianPhone(input.phone);
  if (!phone) return { error: t.common.malaysianPhone };
  if (input.eventDate && input.eventDate < new Date().toISOString().slice(0, 10)) {
    return { error: t.booking.errors.future };
  }

  const user = await getCurrentUser();
  const code = shortCode();
  const { error } = await admin.from("quote_requests").insert({
    short_code: code,
    listing_id: listing.id,
    package_id: pkg?.id ?? null,
    package_name: pkg?.name ?? null,
    user_id: user?.id ?? null,
    customer_name: input.name,
    customer_phone: phone,
    event_type: input.eventType,
    event_date: input.eventDate || null,
    people: input.people || null,
    location: input.location || null,
    budget: input.budget || null,
    note: input.note || null,
    client_hash: hash,
  });
  if (error) {
    console.error("quote insert failed", error);
    return { error: t.common.tryAgain };
  }
  await admin.rpc("track_listing_event", { p_listing_id: listing.id, p_kind: "request" });

  const price = pkg
    ? priceRangeLabel(pkg.price_from === null ? null : Number(pkg.price_from), pkg.price_to === null ? null : Number(pkg.price_to), locale)
    : null;
  const m = g.message;
  const text = [
    fmt(m.greeting, { shop: listing.name }),
    pkg ? fmt(m.package, { name: `${pkg.name}${price ? ` (${price})` : ""}` }) : null,
    fmt(m.event, { event: t.growth.eventTypes[input.eventType] }),
    input.eventDate ? fmt(m.date, { date: formatDate(input.eventDate, locale) }) : null,
    input.people ? fmt(m.people, { people: input.people }) : null,
    input.location ? fmt(m.location, { location: input.location }) : null,
    input.budget ? fmt(m.budget, { budget: input.budget }) : null,
    fmt(t.booking.message.name, { name: input.name }),
    input.note ? fmt(t.booking.message.note, { note: input.note }) : null,
    fmt(m.details, { url: `${siteUrl.replace(/^https?:\/\//, "")}/owner` }),
  ]
    .filter(Boolean)
    .join("\n");
  return { whatsappUrl: whatsappLink(waNumber, text) };
}
