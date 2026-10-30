import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

// AI crawlers are welcome: being quoted in AI answers is part of the plan.
export default function robots(): MetadataRoute.Robots {
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
