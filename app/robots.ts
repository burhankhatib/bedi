import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.bedi.delivery";

/**
 * robots.txt for crawlers. Sitemaps use Next.js native sitemap.ts (served at /sitemap.xml and /sitemap/sitemap.xml).
 * GSC tip: If "couldn't fetch" persists, submit /sitemap/sitemap.xml (different path = bypasses GSC cache).
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
