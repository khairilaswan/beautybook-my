import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_HEADER, localePath, splitLocale } from "@/lib/i18n/config";
import { type AccessStatus, isOpenPath, membersOnly } from "@/lib/site-access";

// Paths outside the [lang] tree: route handlers and Next internals.
const UNLOCALIZED = ["/auth", "/api", "/_next", "/.well-known"];

// 1. Languages: /ms/... and /zh/... are served as they are; any other path
//    is English and is rewritten to /en/... internally. /en/... itself
//    redirects to the unprefixed address so each page has one English URL.
// 2. Refreshes the Supabase session cookie before pages render. In
//    members-only mode it also keeps out anyone who isn't an approved member.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const split = splitLocale(pathname);
  if (split.locale === DEFAULT_LOCALE) {
    const url = request.nextUrl.clone();
    url.pathname = split.path;
    return NextResponse.redirect(url, 308);
  }
  const unlocalized = !split.locale && UNLOCALIZED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const locale = split.locale ?? DEFAULT_LOCALE;
  const path = split.path;
  const open = isOpenPath(path);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);
  const pass = () => {
    if (split.locale || unlocalized) return NextResponse.next({ request: { headers: requestHeaders } });
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  };
  let response = pass();
  const here = (p: string) => localePath(locale, p);

  // Keeps refreshed session cookies when the answer is a redirect.
  const redirectTo = (target: string) => {
    const res = NextResponse.redirect(new URL(target, request.url));
    for (const cookie of response.cookies.getAll()) res.cookies.set(cookie);
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  };
  const done = () => {
    if (membersOnly) response.headers.set("X-Robots-Tag", "noindex");
    return response;
  };

  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasSession) {
    if (membersOnly && !open) return redirectTo(here(`/login?next=${encodeURIComponent(pathname + search)}`));
    return done();
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          requestHeaders.set("cookie", request.cookies.toString());
          response = pass();
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  if (!membersOnly) return done();

  const claims = data?.claims;
  if (!claims) {
    return open ? done() : redirectTo(here(`/login?next=${encodeURIComponent(pathname + search)}`));
  }

  let access = (claims.app_metadata as { access?: AccessStatus } | undefined)?.access;
  if (access !== "approved") {
    // The token may predate an approval: check the database, and if the
    // member has been approved, refresh the token so later requests skip this.
    const { data: row } = await supabase
      .from("member_access")
      .select("status")
      .eq("user_id", claims.sub)
      .maybeSingle();
    access = row?.status as AccessStatus | undefined;
    if (access === "approved") await supabase.auth.refreshSession();
  }

  if (access === "approved") {
    return path === "/pending" ? redirectTo(here("/")) : done();
  }
  return open ? done() : redirectTo(here("/pending"));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
