import { NextResponse, type NextRequest } from "next/server";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, localePath, splitLocale } from "@/lib/i18n/config";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

// OAuth and email-link sign-ins land here with a one-time code.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  // The sign-in started on a page in this language.
  const locale = splitLocale(next).locale ?? DEFAULT_LOCALE;
  const login = new URL(localePath(locale, "/login"), url.origin);
  login.searchParams.set("error", DICTIONARIES[locale].login.errors.expired);
  return NextResponse.redirect(login);
}
