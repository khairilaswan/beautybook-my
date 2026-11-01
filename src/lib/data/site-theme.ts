import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { DEFAULT_THEME, type SiteTheme, normalizeTheme } from "@/lib/themes";

export const SITE_THEME_TAG = "site-theme";

// The theme chosen in /admin/theme. Falls back to the classic look if the
// settings table isn't there yet or can't be read, so a failed read never
// breaks every page.
export async function getSiteTheme(): Promise<SiteTheme> {
  "use cache";
  cacheLife("days");
  cacheTag(SITE_THEME_TAG);
  try {
    const { data, error } = await createPublicClient()
      .from("site_settings")
      .select("theme_style, theme_color")
      .maybeSingle();
    if (error || !data) return DEFAULT_THEME;
    return normalizeTheme(data.theme_style, data.theme_color);
  } catch {
    return DEFAULT_THEME;
  }
}
