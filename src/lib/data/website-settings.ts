import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { DEFAULT_WEBSITE, websiteSchema } from "@/lib/website-settings";

export const WEBSITE_TAG = "website-settings";
export async function getWebsiteSettings() {
  "use cache";
  cacheLife("hours");
  cacheTag(WEBSITE_TAG);
  try {
    const { data } = await createPublicClient()
      .from("site_settings")
      .select("website")
      .eq("id", true)
      .maybeSingle();
    const parsed = websiteSchema.safeParse(data?.website);
    return parsed.success ? parsed.data : DEFAULT_WEBSITE;
  } catch {
    return DEFAULT_WEBSITE;
  }
}
