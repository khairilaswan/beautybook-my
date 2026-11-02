import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tags } from "@/lib/data/directory";
import { createPublicClient } from "@/lib/supabase/public";
import { DEFAULT_THEME, type SiteTheme, normalizeTheme } from "@/lib/themes";

export const SITE_THEME_TAG = "site-theme";

export type SiteSettings = {
  theme: SiteTheme;
  // Shop owners may pick a theme for their own shop page.
  ownerThemes: boolean;
};

// Set in /admin/theme. Falls back to the classic look if the settings table
// isn't there yet or can't be read, so a failed read never breaks every page.
export async function getSiteSettings(): Promise<SiteSettings> {
  "use cache";
  cacheLife("days");
  cacheTag(SITE_THEME_TAG);
  const fallback = { theme: DEFAULT_THEME, ownerThemes: false };
  try {
    const { data, error } = await createPublicClient()
      .from("site_settings")
      .select("theme_style, theme_color, owner_themes")
      .maybeSingle();
    if (error || !data) return fallback;
    return { theme: normalizeTheme(data.theme_style, data.theme_color), ownerThemes: !!data.owner_themes };
  } catch {
    return fallback;
  }
}

export async function getSiteTheme(): Promise<SiteTheme> {
  return (await getSiteSettings()).theme;
}

// A shop's own theme, or null for the site theme. Only read while owner
// themes are switched on (which also means the theme columns exist).
export async function getShopTheme(slug: string): Promise<SiteTheme | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.listing(slug));
  const { data } = await createPublicClient()
    .from("listings")
    .select("theme_style, theme_color")
    .eq("slug", slug)
    .maybeSingle();
  if (!data?.theme_style) return null;
  return normalizeTheme(data.theme_style, data.theme_color);
}
