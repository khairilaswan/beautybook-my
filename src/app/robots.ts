import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { LOCALES, localePath } from "@/lib/i18n/config";
import { membersOnly } from "@/lib/site-access";
import { getWebsiteSettings } from "@/lib/data/website-settings";

// AI crawlers are welcome: being quoted in AI answers is part of the plan.
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (membersOnly || !(await getWebsiteSettings()).indexing) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          ...LOCALES.flatMap((l) =>
            ["/admin", "/owner", "/account", "/claim", "/r/", "/login"].map((p) => localePath(l, p)),
          ),
          "/auth",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
