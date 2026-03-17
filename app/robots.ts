import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.bedi.delivery";

/**
 * robots.txt for crawlers. Sitemap URLs:
 * - Primary: /sitemap/sitemap.xml (use this in GSC if /sitemap.xml was cached as failed)
 * - Fallback: /sitemap.xml
 * GSC tip: Submit with trailing slash (e.g. .../sitemap/sitemap.xml/) to force fresh fetch.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/studio/", "/admin/", "/api/", "/sign-in", "/sign-up", "/onboarding", "/dashboard", "/driver",  "/resolve", "/verify-phone"],
    },
    sitemap: [`${BASE_URL}/sitemap.xml`, `${BASE_URL}/sitemap/sitemap.xml`],
    host: BASE_URL.replace(/^https?:\/\//, ""),
  };
}
