import { client } from '@/sanity/lib/client'

/** Cache 60s to reduce Sanity API calls for repeated visits. */
export const revalidate = 60

/**
 * GET /api/home/cities
 * Returns unique cities from tenants that have at least one business.
 * No country filter - cities are derived from business locations.
 */
export async function GET() {
  const tenants = await client.fetch<Array<{ city: string | null }>>(
    `*[_type == "tenant" && !deactivated && ((subscriptionExpiresAt != null && subscriptionExpiresAt > now()) || (subscriptionExpiresAt == null && (!defined(createdAt) || dateTime(createdAt) + 2592000 > now()))) && defined(city) && city != ""]{ city }`
  )

  const cities = Array.from(
    new Set((tenants ?? []).map((t) => (t?.city ?? '').trim()).filter(Boolean))
  ).sort()

  return Response.json({ cities })
}
