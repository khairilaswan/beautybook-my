import { SITE_URL } from "@/lib/env";
import type { Locale } from "@/lib/i18n/config";
import { supabase } from "@/lib/supabase";

// Calls to the website's /api/mobile routes (src/app/api/mobile on the web
// side) for the writes that run on the server: booking and quote requests,
// account deletion and refreshing the website's cache.

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string | null };

async function call<T>(
  path: string,
  { method = "POST", body, locale }: { method?: "GET" | "POST" | "DELETE"; body?: unknown; locale: Locale },
): Promise<ApiResult<T>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  try {
    const res = await fetch(`${SITE_URL}/api/mobile/${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-app-locale": locale,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    const error = json && typeof json === "object" && "error" in json && typeof json.error === "string" ? json.error : null;
    if (!res.ok || error) return { ok: false, status: res.status, error };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, error: null };
  }
}

export type AppConfig = {
  membersOnly: boolean;
  loginMethods: { google: boolean; facebook: boolean; phone: boolean; apple: boolean };
  reviewsEnabled: boolean;
  referralPoints: number;
  paymentsEnabled: boolean;
  remindersEnabled: boolean;
  siteUrl: string;
  minAppVersion: string | null;
};

// Used when the website can't be reached: the safe choices (members-only,
// only the sign-in methods that are set up today, no reviews).
export const FALLBACK_CONFIG: AppConfig = {
  membersOnly: true,
  loginMethods: { google: true, facebook: false, phone: false, apple: false },
  reviewsEnabled: false,
  referralPoints: 100,
  paymentsEnabled: false,
  remindersEnabled: false,
  siteUrl: SITE_URL,
  minAppVersion: null,
};

export async function fetchConfig(locale: Locale): Promise<AppConfig | null> {
  const res = await call<AppConfig>("config", { method: "GET", locale });
  return res.ok ? res.data : null;
}

export type Slot = { time: string; left: number };

export type BookingResult = {
  whatsappUrl?: string;
  confirmed?: { shortCode: string; when: string; shopName: string };
};

export type BookingBody = {
  listingId: string;
  serviceId: number;
  date: string;
  time: string;
  name: string;
  phone: string;
  note: string;
  staffId: number | "";
  promotionId: number | "";
};

export function sendBooking(body: BookingBody, locale: Locale) {
  return call<BookingResult>("booking", { body, locale });
}

export async function fetchSlots(
  body: { listingId: string; date: string; serviceId: number; staffId: number | null },
  locale: Locale,
): Promise<Slot[] | null> {
  const res = await call<{ slots: Slot[] }>("availability", { body, locale });
  return res.ok ? res.data.slots : null;
}

export type QuoteBody = {
  listingId: string;
  packageId: number | "";
  eventType: string;
  eventDate: string;
  people: number | "";
  location: string;
  budget: string;
  name: string;
  phone: string;
  note: string;
};

export function sendQuote(body: QuoteBody, locale: Locale) {
  return call<{ whatsappUrl?: string }>("quote", { body, locale });
}

export type TrackKind = "view" | "whatsapp" | "call" | "directions" | "website";

// Fire and forget: counts for the shop owner's analytics.
export function track(listingId: string, kind: TrackKind, locale: Locale): void {
  void call<null>("track", { body: { listingId, kind }, locale });
}

export function deleteAccount(locale: Locale) {
  return call<null>("account", { method: "DELETE", locale });
}

// After an owner edit or a review saved from the app, so the website shows it
// straight away. Failing is harmless: the website's cache expires on its own.
export function refreshWebsite(listingId: string, scope: "listing" | "reviews", locale: Locale): void {
  void call<null>("revalidate", { body: { listingId, scope }, locale });
}
