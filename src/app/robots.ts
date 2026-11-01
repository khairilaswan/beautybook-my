import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { membersOnly } from "@/lib/site-access";

// AI crawlers are welcome: being quoted in AI answers is part of the plan.
export default function robots(): MetadataRoute.Robots {
  if (membersOnly) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/owner", "/account", "/claim", "/r/", "/login", "/auth"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
