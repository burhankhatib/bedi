import type { MetadataRoute } from "next";
import { client } from "@/sanity/lib/client";
import { SITEMAP_TENANTS_QUERY } from "@/sanity/lib/queries";

/** Generate sitemap on each request so Googlebot gets fresh content (avoids build-time Sanity fetch failures). */
export const dynamic = "force-dynamic";

export const BASE_SITEMAP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.bedi.delivery";

/** Static pages to include in the sitemap */
const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: BASE_SITEMAP_URL, changeFrequency: "daily" as const, priority: 1 },
  { url: `${BASE_SITEMAP_URL}/search`, changeFrequency: "daily" as const, priority: 0.9 },
  { url: `${BASE_SITEMAP_URL}/join`, changeFrequency: "monthly" as const, priority: 0.9 },
  { url: `${BASE_SITEMAP_URL}/driver`, changeFrequency: "monthly" as const, priority: 0.9 },
  { url: `${BASE_SITEMAP_URL}/about`, changeFrequency: "monthly" as const, priority: 0.7 },
  { url: `${BASE_SITEMAP_URL}/contact`, changeFrequency: "monthly" as const, priority: 0.7 },
  { url: `${BASE_SITEMAP_URL}/pricing`, changeFrequency: "monthly" as const, priority: 0.7 },
  { url: `${BASE_SITEMAP_URL}/terms`, changeFrequency: "yearly" as const, priority: 0.3 },
  { url: `${BASE_SITEMAP_URL}/privacy`, changeFrequency: "yearly" as const, priority: 0.3 },
  { url: `${BASE_SITEMAP_URL}/refund-policy`, changeFrequency: "yearly" as const, priority: 0.3 },
];

/** Shared sitemap entries for both metadata route and XML route (GSC needs correct Content-Type at /sitemap.xml). */
export async function getSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  let tenantPages: MetadataRoute.Sitemap = [];

  try {
    const tenants = await client.fetch<Array<{ slug: string; _updatedAt?: string }>>(
      SITEMAP_TENANTS_QUERY
    );
    if (Array.isArray(tenants)) {
      tenantPages = tenants
        .filter((t) => t?.slug && typeof t.slug === "string")
        .map((t) => ({
          url: `${BASE_SITEMAP_URL}/t/${encodeURIComponent(t.slug)}`,
          lastModified: t._updatedAt ? new Date(t._updatedAt) : undefined,
          changeFrequency: "weekly" as const,
          priority: 0.8,
        }));
    }
  } catch (err) {
    console.error("[Sitemap] Failed to fetch tenants:", err);
  }

  return [...STATIC_PAGES, ...tenantPages];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getSitemapEntries();
}
