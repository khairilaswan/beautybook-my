import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/lib/i18n/config";
import { REFERRAL_COOKIE } from "@/lib/referrals";

// A friend's invite link: remember the code for 30 days, then send them to
// sign up. The code only counts for an account created after this visit.
export async function GET(request: NextRequest, { params }: RouteContext<"/[lang]/invite/[code]">) {
  const { lang, code } = await params;
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const target = `${localePath(locale, "/login")}?next=${encodeURIComponent(localePath(locale, "/account"))}&invited=1`;
  const res = NextResponse.redirect(new URL(target, request.url));
  if (/^[0-9A-Fa-f]{8}$/.test(code)) {
    res.cookies.set(REFERRAL_COOKIE, code.toUpperCase(), {
      maxAge: 30 * 86_400,
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
    });
  }
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}
