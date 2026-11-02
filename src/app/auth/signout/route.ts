import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, localePath, splitLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Back to the home page in the language the visitor was using.
  const referer = request.headers.get("referer");
  let locale = DEFAULT_LOCALE;
  try {
    if (referer) locale = splitLocale(new URL(referer).pathname).locale ?? DEFAULT_LOCALE;
  } catch {
    // Malformed referer: English home.
  }
  return NextResponse.redirect(new URL(localePath(locale, "/"), request.nextUrl.origin), { status: 303 });
}
