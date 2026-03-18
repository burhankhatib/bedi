/**
 * Sanity fetch wrapper with Next.js Data Cache integration.
 *
 * Standard client.fetch() does NOT use Next.js Data Cache. This helper passes
 * next: { revalidate, tags } so responses are cached and count against Next.js
 * cache, not the live Sanity API on every request.
 *
 * Use for: store pages, categories, products, home sections, banners.
 * Use client.fetch() directly (no cache) only when you need fresh data:
 *   - order/status changes, driver assignment, mutations
 *   - real-time dashboards where staleness is unacceptable
 */
import { client } from './client'

export type SanityFetchOptions = {
  /** Next.js revalidate in seconds. Default 3600 (1 hour). Use false for tag-only. */
  revalidate?: number | false
  /** Next.js cache tags for revalidateTag(). Use for selective invalidation. */
  tags?: string[]
  /** Sanity request tag for Usage dashboard (sanity.io/manage). Shows as requestTagPrefix.tag */
  tag?: string
}

/**
 * Fetch from Sanity with Next.js Data Cache.
 * Pass tags for the 3 most frequent queries so you can identify culprits in Sanity Usage.
 */
export async function sanityFetch<QueryResponse>(
  query: string,
  params: Record<string, unknown> = {},
  options: SanityFetchOptions = {}
): Promise<QueryResponse> {
  const { revalidate = 3600, tags = [], tag } = options

  return client.fetch<QueryResponse>(query, params, {
    tag,
    next: {
      revalidate: tags.length ? false : revalidate,
      tags: tags.length ? tags : undefined,
    },
  })
}
