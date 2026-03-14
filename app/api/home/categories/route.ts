import { NextRequest } from 'next/server'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'

/** Cached per URL (city) for 60s to reduce Sanity API usage. */
export const revalidate = 60

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
  let storesCount = 0
  for (const t of tenants ?? []) {
    const v = t?.businessType ?? ''
    if (v) {
      tenantCounts.set(v, (tenantCounts.get(v) ?? 0) + 1)
      if (v !== 'restaurant' && v !== 'cafe') storesCount++
    }
  }

  const result: Array<{ _id: string; value: string; name_en: string; name_ar: string; imageUrl: string | null; tenantCount: number }> = []

  // Inject "stores" when there are store-type businesses (supermarket, grocery, pharmacy, etc.)
  if (storesCount > 0) {
    const storesImage = (categories ?? []).find((c) =>
      ['grocery', 'supermarket', 'greengrocer', 'retail', 'pharmacy', 'bakery'].includes(c.value ?? '')
    )?.image
    result.push({
      _id: 'stores',
      value: 'stores',
      name_en: 'Stores',
      name_ar: 'متاجر',
      imageUrl: storesImage?.asset?._ref ? urlFor(storesImage).width(400).height(400).url() : null,
      tenantCount: storesCount,
    })
  }

  const categoryResults = (categories ?? [])
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

  const merged = [...result, ...categoryResults].sort((a, b) => b.tenantCount - a.tenantCount)
  return Response.json(merged)
}
