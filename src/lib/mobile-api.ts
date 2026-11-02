import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { DICTIONARIES, type Dictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, type Locale, isLocale } from "@/lib/i18n/config";
import { clientHash } from "@/lib/request";
import { membersOnly } from "@/lib/site-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";

// The mobile app (mobile/) talks to Supabase directly for everything RLS
// allows, and to these /api/mobile routes for the few writes that run on the
// server: booking and quote requests, account deletion and cache refreshes.
// The app sends the user's Supabase access token as a Bearer token.

// The app's language. Not x-bb-locale: the proxy sets that one to the URL's
// language, which for /api is always English.
export const APP_LOCALE_HEADER = "x-app-locale";

export type MobileContext = {
  locale: Locale;
  t: Dictionary;
  user: { id: string; createdAt: string } | null;
  // Salted hash of the account id, for the same hourly limits the website
  // applies per IP address.
  hash: string | null;
};

export function mobileLocale(request: NextRequest): Locale {
  const value = request.headers.get(APP_LOCALE_HEADER);
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

// Checks the Bearer token with Supabase Auth and, while the site is
// members-only, that the account has been approved. With `optional`, a
// request without a token passes when the site is open to everyone. With
// `allowPending`, accounts still waiting for approval pass too (deleting an
// account must always work).
export async function mobileContext(
  request: NextRequest,
  { optional = false, allowPending = false }: { optional?: boolean; allowPending?: boolean } = {},
): Promise<MobileContext | NextResponse> {
  const locale = mobileLocale(request);
  const t = DICTIONARIES[locale];
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    if (optional && !membersOnly) return { locale, t, user: null, hash: null };
    return jsonError(t.nav.signIn, 401);
  }

  const { data, error } = await createPublicClient().auth.getUser(token);
  if (error || !data.user) return jsonError(t.nav.signIn, 401);

  if (membersOnly && !allowPending) {
    const { data: access } = await createAdminClient()
      .from("member_access")
      .select("status")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (access?.status !== "approved") return jsonError(t.pending.metaTitle, 403);
  }

  return {
    locale,
    t,
    user: { id: data.user.id, createdAt: data.user.created_at },
    hash: clientHash(`app:${data.user.id}`),
  };
}

// Request bodies are JSON objects; anything else reads as empty.
export async function jsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
