import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

// Request-scoped client acting as the signed-in user, so RLS applies.
// Reads cookies: only call it inside a Suspense boundary, a server action or
// a route handler.
export async function createClient() {
  // Auth checks read the clock (token expiry); mark the render as request-time
  // so prerendering never tries to evaluate them.
  await connection();
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The proxy refreshes the
          // session on every request, so this is safe to ignore.
        }
      },
    },
  });
}
