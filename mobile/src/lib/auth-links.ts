import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";

// Where Supabase sends people back after Google, Facebook or an email link:
// beautybook://auth/callback in the store app, exp://…/--/auth/callback in
// Expo Go. Both must be in Supabase Auth's redirect URLs (see mobile/README.md).
export function authRedirectUrl(): string {
  return Linking.createURL("auth/callback");
}

// The sign-in screen and the auth/callback route can both see the same code
// (Android delivers the redirect to both), so each code is exchanged once.
const exchanges = new Map<string, Promise<boolean>>();

export function exchangeCode(code: string): Promise<boolean> {
  let p = exchanges.get(code);
  if (!p) {
    p = supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => !error)
      .catch(() => false);
    exchanges.set(code, p);
  }
  return p;
}

export function codeFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("code");
  } catch {
    const match = /[?&]code=([^&#]+)/.exec(url);
    return match ? decodeURIComponent(match[1]) : null;
  }
}
