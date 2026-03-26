import { sanityFetch } from "@/sanity/lib/fetch";
import { SITEMAP_TENANTS_QUERY } from "@/sanity/lib/queries";

export const BASE_SITEMAP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.bedi.delivery";

/** Static pages to include in the sitemap */
const STATIC_PAGES: Array<{ url: string; changeFrequency: string; priority: number }> = [
  { url: BASE_SITEMAP_URL, changeFrequency: "daily", priority: 1 },
  { url: `${BASE_SITEMAP_URL}/search`, changeFrequency: "daily", priority: 0.9 },
  { url: `${BASE_SITEMAP_URL}/join`, changeFrequency: "monthly", priority: 0.9 },
  { url: `${BASE_SITEMAP_URL}/about`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${BASE_SITEMAP_URL}/contact`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${BASE_SITEMAP_URL}/pricing`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${BASE_SITEMAP_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
  { url: `${BASE_SITEMAP_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  { url: `${BASE_SITEMAP_URL}/refund-policy`, changeFrequency: "yearly", priority: 0.3 },
];

function safeLastModified(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(value as string | number);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10); // YYYY-MM-DD per sitemaps.org
}

export interface SitemapEntry {
  url: string;
  lastModified?: string | null;
  changeFrequency: string;
  priority: number;
}

/** Convert to Next.js MetadataRoute.Sitemap format for native sitemap.ts */
export function toMetadataRouteSitemap(entries: SitemapEntry[]): Array<{
  url: string;
  lastModified?: string | Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}> {
  return entries.map((e) => {
    const entry: { url: string; lastModified?: Date; changeFrequency?: "daily" | "weekly" | "monthly" | "yearly" | "never"; priority?: number } = {
      url: e.url,
      changeFrequency: e.changeFrequency as "daily" | "weekly" | "monthly" | "yearly" | "never",
      priority: e.priority,
    };
    if (e.lastModified) entry.lastModified = new Date(e.lastModified);
    return entry;
  });
}

/** Fetch all sitemap entries (static + tenant pages from Sanity). */
export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [...STATIC_PAGES.map((p) => ({ ...p, lastModified: null }))];

  try {
    const tenants = await sanityFetch<Array<{ slug: string; _updatedAt?: string }>>(
      SITEMAP_TENANTS_QUERY,
      {},
      { revalidate: 3600, tags: ['sitemap'] }
    );
    if (Array.isArray(tenants)) {
      for (const t of tenants) {
        if (t?.slug && typeof t.slug === "string") {
          entries.push({
            url: `${BASE_SITEMAP_URL}/t/${encodeURIComponent(t.slug)}`,
            lastModified: safeLastModified(t._updatedAt),
            changeFrequency: "weekly",
            priority: 0.8,
          });
        }
      }
    }
  } catch (err) {
    console.error("[Sitemap] Failed to fetch tenants:", err);
  }

  return entries;
}

/** Escape XML special characters for valid sitemap output. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate valid sitemap XML per sitemaps.org protocol.
 * Used by route handlers so Google Search Console receives correct Content-Type and schema.
 */
export function buildSitemapXml(entries: SitemapEntry[]): string {
  const urlElements = entries
    .map((e) => {
      let xml = `  <url>\n    <loc>${escapeXml(e.url)}</loc>`;
      if (e.lastModified) {
        xml += `\n    <lastmod>${escapeXml(e.lastModified)}</lastmod>`;
      }
      xml += `\n    <changefreq>${escapeXml(e.changeFrequency)}</changefreq>`;
      xml += `\n    <priority>${e.priority.toFixed(1)}</priority>`;
      xml += "\n  </url>";
      return xml;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>`;
}
