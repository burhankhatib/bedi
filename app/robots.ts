import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.bedi.delivery";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/studio/", "/admin/", "/api/", "/sign-in", "/sign-up", "/onboarding", "/dashboard", "/driver", "/listings/", "/resolve", "/verify-phone"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL.replace(/^https?:\/\//, ""),
  };
}
