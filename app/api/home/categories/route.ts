import { NextRequest } from 'next/server'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'

/** Dynamic route to ensure city-specific categories don't get mixed via static cache. */
export const dynamic = 'force-dynamic'

/**
 * GET /api/home/categories?city=Jerusalem
 * Returns categories that have at least one tenant in that city.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const city = searchParams.get('city') ?? ''

  const { categories, tenants } = await client.fetch<{
    categories: Array<{
      _id: string
      value: string
      name_en: string
      name_ar: string
      image: { asset?: { _ref: string } }
      sortOrder?: number
    }>
    tenants: Array<{ businessType: string }>
  }>(
    `{
      "categories": *[_type == "businessCategory"] | order(sortOrder asc) {
        _id,
        value,
        name_en,
        name_ar,
        image,
        sortOrder
      },
      "tenants": *[_type == "tenant" && (city == $city || lower(city) == lower($city)) && !deactivated && ((subscriptionExpiresAt != null && subscriptionExpiresAt > now()) || (subscriptionExpiresAt == null && (!defined(createdAt) || dateTime(createdAt) + 2592000 > now())))]{ businessType }
    }`,
    { city }
  )

  const tenantCounts = new Map<string, number>()
  for (const t of tenants ?? []) {
    const v = t?.businessType ?? ''
    if (v) tenantCounts.set(v, (tenantCounts.get(v) ?? 0) + 1)
  }

  const result = (categories ?? [])
    .filter((c) => (tenantCounts.get(c.value ?? '') ?? 0) > 0)
    .map((c) => {
      const imageUrl = c.image?.asset?._ref
        ? urlFor(c.image).width(400).height(400).url()
        : null
      return {
        _id: c._id,
        value: c.value,
        name_en: c.name_en,
        name_ar: c.name_ar,
        imageUrl,
        tenantCount: tenantCounts.get(c.value ?? '') ?? 0,
      }
    })

  return Response.json(result)
}
