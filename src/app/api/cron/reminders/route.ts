import { NextResponse, type NextRequest } from "next/server";
import { formatDate } from "@/lib/format";
import { malaysiaNow } from "@/lib/hours";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { isLocale, fmt, localePath } from "@/lib/i18n/config";
import { localTime } from "@/lib/i18n/names";
import { listingPath } from "@/lib/paths";
import { sendReminder } from "@/lib/reminders";
import { remindersEnabled } from "@/lib/setup";
import { siteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// Runs daily (vercel.json). Sends opted-in customers (1) a reminder for
// tomorrow's confirmed bookings and (2) a "time for a touch-up" nudge once a
// completed visit is older than the service's usual gap. Each booking gets at
// most one of each.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!remindersEnabled()) return NextResponse.json({ skipped: "no reminder channel set up" });

  const admin = createAdminClient();
  const today = malaysiaNow().date;
  const tomorrowStart = new Date(new Date(`${today}T00:00:00+08:00`).getTime() + 86_400_000);
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 86_400_000);

  type Row = {
    id: string;
    user_id: string;
    listing_id: string;
    service_name: string;
    staff_name: string | null;
    preferred_at: string | null;
    created_at: string;
    customer_phone: string | null;
    listings: { slug: string; name: string; listing_categories: { is_primary: boolean; categories: { rebook_days: number | null } }[] };
  };
  const select =
    "id, user_id, listing_id, service_name, staff_name, preferred_at, created_at, customer_phone, listings ( slug, name, listing_categories ( is_primary, categories ( rebook_days ) ) )";

  const [upcoming, completed] = await Promise.all([
    admin
      .from("booking_requests")
      .select(select)
      .eq("status", "confirmed")
      .is("reminder_sent_at", null)
      .not("user_id", "is", null)
      .gte("preferred_at", tomorrowStart.toISOString())
      .lt("preferred_at", tomorrowEnd.toISOString())
      .limit(500),
    admin
      .from("booking_requests")
      .select(select)
      .eq("status", "completed")
      .is("rebook_sent_at", null)
      .not("user_id", "is", null)
      .lt("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  const rows = [...((upcoming.data ?? []) as unknown as Row[]), ...((completed.data ?? []) as unknown as Row[])];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  if (!userIds.length) return NextResponse.json({ reminders: 0, nudges: 0 });

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name, phone, reminders_opt_in, preferred_lang")
    .in("id", userIds)
    .eq("reminders_opt_in", true);
  const people = new Map((profiles ?? []).map((p) => [p.id, p]));
  // Each message goes out in the customer's chosen language.
  const wordsFor = (p: { preferred_lang: string | null }) => {
    const locale = isLocale(p.preferred_lang) ? p.preferred_lang : "en";
    return { locale, w: DICTIONARIES[locale].growth.reminders };
  };
  const emails = new Map<string, string | null>();
  const emailOf = async (id: string) => {
    if (!emails.has(id)) emails.set(id, (await admin.auth.admin.getUserById(id)).data.user?.email ?? null);
    return emails.get(id)!;
  };

  let reminders = 0;
  for (const r of (upcoming.data ?? []) as unknown as Row[]) {
    const p = people.get(r.user_id);
    if (!p || !r.preferred_at) continue;
    const { locale, w } = wordsFor(p);
    const name = p.display_name ?? w.there;
    const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(r.preferred_at));
    const when = `${formatDate(r.preferred_at, locale)}, ${localTime(time, locale)}`;
    const link = `${siteUrl}${localePath(locale, listingPath(r.listings.slug))}`;
    const service = `${r.service_name}${r.staff_name ? ` (${r.staff_name})` : ""}`;
    const ok = await sendReminder({
      phone: p.phone ?? r.customer_phone,
      email: await emailOf(r.user_id),
      subject: fmt(w.reminderSubject, { service: r.service_name, shop: r.listings.name }),
      params: [name, r.listings.name, `${r.service_name}, ${when}`, link],
      text: fmt(w.reminderText, { name, service, shop: r.listings.name, when, link }),
      footer: fmt(w.stop, { url: `${siteUrl}${localePath(locale, "/account")}` }),
    });
    if (ok) {
      await admin.from("booking_requests").update({ reminder_sent_at: new Date().toISOString() }).eq("id", r.id);
      reminders++;
    }
  }

  // Only the latest completed visit per customer and shop is nudged.
  let nudges = 0;
  const seen = new Set<string>();
  for (const r of (completed.data ?? []) as unknown as Row[]) {
    const key = `${r.user_id}:${r.listing_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = people.get(r.user_id);
    const cats = r.listings.listing_categories;
    const days = (cats.find((c) => c.is_primary) ?? cats[0])?.categories.rebook_days;
    const visited = new Date(r.preferred_at ?? r.created_at).getTime();
    if (!p || !days || Date.now() - visited < days * 86_400_000) continue;
    const { count } = await admin
      .from("booking_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", r.user_id)
      .eq("listing_id", r.listing_id)
      .gt("created_at", r.created_at);
    if (count) {
      await admin.from("booking_requests").update({ rebook_sent_at: new Date().toISOString() }).eq("id", r.id);
      continue;
    }
    const { locale, w } = wordsFor(p);
    const name = p.display_name ?? w.there;
    const link = `${siteUrl}${localePath(locale, listingPath(r.listings.slug))}#book`;
    const ok = await sendReminder({
      phone: p.phone ?? r.customer_phone,
      email: await emailOf(r.user_id),
      subject: fmt(w.nudgeSubject, { shop: r.listings.name }),
      params: [name, r.listings.name, fmt(w.nudgeDetail, { service: r.service_name }), link],
      text: fmt(w.nudgeText, { name, service: r.service_name, shop: r.listings.name, link }),
      footer: fmt(w.stop, { url: `${siteUrl}${localePath(locale, "/account")}` }),
    });
    if (ok) {
      await admin.from("booking_requests").update({ rebook_sent_at: new Date().toISOString() }).eq("id", r.id);
      nudges++;
    }
  }
  return NextResponse.json({ reminders, nudges });
}
