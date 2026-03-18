import type { MetadataRoute } from "next";
import { getSitemapEntries, toMetadataRouteSitemap } from "@/lib/sitemap";

/**
 * Nested sitemap at /sitemap/sitemap.xml — same content as root /sitemap.xml.
 * Use this URL in GSC if /sitemap.xml was cached as "couldn't fetch" (different path = fresh fetch).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getSitemapEntries();
  return toMetadataRouteSitemap(entries);
}
