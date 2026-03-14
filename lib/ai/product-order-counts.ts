/**
 * Fetches product order counts (popularity) for completed orders. Cached per city.
 */
import { client } from '@/sanity/lib/client'

const CACHE_MS = 5 * 60 * 1000 // 5 min
const cache = new Map<string, { counts: Map<string, number>; expires: number }>()

/** Get order count per product _id for products in this city. Uses completed/served orders. */
export async function getProductOrderCounts(
  city: string,
  country?: string
): Promise<Map<string, number>> {
  const key = `${city}:${country ?? ''}`
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) return cached.counts

  const countryFilter = country ? `&& (site->country == $country || lower(site->country) == lower($country))` : ''
  const orders = await client.fetch<
    Array<{ items?: Array<{ product?: { _ref?: string } }> }>
  >(
    `*[_type == "order" && status in ["completed", "served"] && (site->city == $city || lower(site->city) == lower($city)) ${countryFilter}] | order(createdAt desc) [0...800] {
      "items": items[] { "product": product }
    }`,
    { city, ...(country ? { country } : {}) }
  )

  const counts = new Map<string, number>()
  for (const order of orders ?? []) {
    const seen = new Set<string>()
    for (const item of order.items ?? []) {
      const ref = item.product?._ref
      if (ref && !seen.has(ref)) {
        seen.add(ref)
        counts.set(ref, (counts.get(ref) ?? 0) + 1)
      }
    }
  }

  cache.set(key, { counts, expires: Date.now() + CACHE_MS })
  return counts
}
