import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { type AccessStatus, isOpenPath, membersOnly } from "@/lib/site-access";

// Refreshes the Supabase session cookie before pages render. In members-only
// mode it also keeps out anyone who isn't an approved member.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname, search } = request.nextUrl;
  const open = isOpenPath(pathname);

  // Keeps refreshed session cookies when the answer is a redirect.
  const redirectTo = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url));
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
    if (membersOnly && !open) return redirectTo(`/login?next=${encodeURIComponent(pathname + search)}`);
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
          response = NextResponse.next({ request });
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
    return open ? done() : redirectTo(`/login?next=${encodeURIComponent(pathname + search)}`);
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
    return pathname === "/pending" ? redirectTo("/") : done();
  }
  return open ? done() : redirectTo("/pending");
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
