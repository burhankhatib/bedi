import type { MetadataRoute } from "next";
import { getSitemapEntries, toMetadataRouteSitemap } from "@/lib/sitemap";

/**
 * Next.js native sitemap — served at /sitemap.xml.
 * Uses the built-in MetadataRoute.Sitemap so Google Search Console reliably
 * fetches it (no custom route handler, correct Content-Type, no middleware interference).
 *
 * Cached by default; revalidates when Sanity data changes.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getSitemapEntries();
  return toMetadataRouteSitemap(entries);
}
