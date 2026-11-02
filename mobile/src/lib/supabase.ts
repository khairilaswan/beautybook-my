import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, envReady } from "@/lib/env";

// One client for the whole app. The session is kept on the device and
// refreshed while the app is in the foreground. Row-level security in the
// database decides what each user can read and change, exactly as on the website.
export const supabase = createClient(
  envReady ? SUPABASE_URL : "https://missing-config.supabase.co",
  envReady ? SUPABASE_PUBLISHABLE_KEY : "missing",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      lock: processLock,
    },
  },
);

AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export function photoUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/listing-photos/${storagePath}`;
}

export function videoUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/listing-videos/${storagePath}`;
}
