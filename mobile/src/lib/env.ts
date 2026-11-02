// Set in eas.json per build profile, or in mobile/.env for `npx expo start`
// (see .env.example). EXPO_PUBLIC_* values are inlined at build time, so they
// must be read with literal process.env.EXPO_PUBLIC_* expressions. The
// defaults are the live BeautyBook project; both values are public (the
// website sends them to every browser and RLS guards the data).
export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || "https://durmgbtwgfjjmezdanda.supabase.co").replace(/\/$/, "");
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_VnwHPZZ6QF-94mHOpvwHWQ_bMydTgnJ";
// The website, which also serves the app's API (/api/mobile/*).
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || "https://beautybook.my").replace(/\/$/, "");

export const envReady = SUPABASE_URL !== "" && SUPABASE_PUBLISHABLE_KEY !== "";
