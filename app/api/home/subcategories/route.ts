import { NextRequest } from 'next/server'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'

/** Cache 60s per (city, category) to reduce Sanity API calls. */
export const revalidate = 60

type ImageSource = { asset?: { _ref: string } } | null | undefined

/**
 * GET /api/home/subcategories?city=Jerusalem&category=restaurant
 * Returns business sub-categories that are in use by at least one tenant in the city.
 * If category is provided, only sub-categories for that business type are returned.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const city = searchParams.get('city') ?? ''
  const category = searchParams.get('category') ?? ''

  // Get tenant IDs in city that have businessSubcategories
  const tenants = await client.fetch<
    Array<{ _id: string; businessSubcategoryIds: string[] }>
  >(
    `*[_type == "tenant" && (city == $city || lower(city) == lower($city)) && !deactivated && ((subscriptionExpiresAt != null && subscriptionExpiresAt > now()) || (subscriptionExpiresAt == null && (!defined(createdAt) || dateTime(createdAt) + 2592000 > now()))) && count(businessSubcategories) > 0] {
      _id,
      "businessSubcategoryIds": businessSubcategories[]._ref
    }`,
    { city }
  )

  const usedSubcategoryIds = new Set<string>()
  const tenantCountBySubcategory = new Map<string, number>()
  for (const t of tenants ?? []) {
    for (const id of t.businessSubcategoryIds ?? []) {
      if (id) {
        usedSubcategoryIds.add(id)
        tenantCountBySubcategory.set(id, (tenantCountBySubcategory.get(id) ?? 0) + 1)
      }
    }
  }

  if (usedSubcategoryIds.size === 0) {
    return Response.json([])
  }

  const subcategories = await client.fetch<
    Array<{
      _id: string
      slug: { current?: string }
      title_en: string
      title_ar: string
      businessType: string
      image?: ImageSource
      sortOrder?: number
    }>
  >(
    `*[_type == "businessSubcategory" && _id in $ids ${
      category ? '&& businessType == $category' : ''
    }] | order(sortOrder asc, title_en asc) {
      _id,
      "slug": slug.current,
      title_en,
      title_ar,
      businessType,
      image,
      sortOrder
    }`,
    { ids: Array.from(usedSubcategoryIds), ...(category ? { category } : {}) }
  )

  const result = (subcategories ?? [])
    .filter((s) => usedSubcategoryIds.has(s._id))
    .map((s) => {
      const slug = typeof s.slug === 'string' ? s.slug : (s.slug as { current?: string })?.current ?? ''
      const imageUrl = s.image?.asset?._ref ? urlFor(s.image).width(400).height(400).url() : null
      return {
        _id: s._id,
        slug,
        title_en: s.title_en ?? '',
        title_ar: s.title_ar ?? '',
        businessType: s.businessType ?? '',
        imageUrl,
        tenantCount: tenantCountBySubcategory.get(s._id) ?? 0,
      }
    })

  return Response.json(result)
}
