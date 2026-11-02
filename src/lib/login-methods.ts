import "server-only";
import { cacheLife } from "next/cache";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

// apple is used by the mobile app only (Sign in with Apple on iPhone).
export type LoginMethods = { google: boolean; facebook: boolean; phone: boolean; apple: boolean };

// Which sign-in providers are switched on in Supabase Auth, so the login page
// only offers buttons that work. Falls back to showing everything if Auth
// can't be reached; the button then shows Supabase's own error.
export async function getLoginMethods(): Promise<LoginMethods> {
  "use cache";
  cacheLife("minutes");
  try {
    const res = await fetch(`${supabaseUrl()}/auth/v1/settings`, {
      headers: { apikey: supabasePublishableKey() },
    });
    if (!res.ok) throw new Error(`auth settings ${res.status}`);
    const { external } = (await res.json()) as { external?: Partial<LoginMethods> };
    return {
      google: !!external?.google,
      facebook: !!external?.facebook,
      phone: !!external?.phone,
      apple: !!external?.apple,
    };
  } catch (e) {
    console.error("could not read auth settings", e);
    return { google: true, facebook: true, phone: true, apple: false };
  }
}
