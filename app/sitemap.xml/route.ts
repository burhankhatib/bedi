import { BASE_SITEMAP_URL, buildSitemapXml, getSitemapEntries } from "@/lib/sitemap";

/**
 * Serves /sitemap.xml with explicit Content-Type for Google Search Console.
 * Uses route handler (not MetadataRoute) so GSC reliably receives valid XML.
 * Revalidates every hour to balance freshness and crawl reliability.
 */
export const revalidate = 3600;

export async function GET() {
  try {
    const entries = await getSitemapEntries();
    const xml = buildSitemapXml(entries);

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[Sitemap] Error generating sitemap:", err);
    // Fallback: minimal valid sitemap so GSC doesn't get 500
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${BASE_SITEMAP_URL}/</loc><changefreq>daily</changefreq><priority>1</priority></url>
</urlset>`;
    return new Response(fallback, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  }
}
