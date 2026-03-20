import { NextRequest } from 'next/server'
import { client, clientNoCdn } from '@/sanity/lib/client'
import { writeToken } from '@/sanity/lib/write-token'
import { urlFor } from '@/sanity/lib/image'
import { BUSINESS_TYPES, STORE_BUSINESS_TYPES } from '@/lib/constants'

/** Canonical `businessSubcategory.*` docs need authenticated reads (same as public specialties API). */
const subcatReadClient = writeToken
  ? clientNoCdn.withConfig({ token: writeToken, useCdn: false })
  : client

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
  const categoryParam = searchParams.get('category') ?? ''

  const isStores = categoryParam === 'stores'
  const category =
    isStores ? '' // no single businessType; subcatFilter will use stores list
    : categoryParam || ''

  // For category=stores we show store-type categories (Grocery, Pharmacy, Butcher...) instead of tenant specialties.
  if (isStores) {
    const displayOrder = ['grocery', 'greengrocer', 'pharmacy', 'bakery', 'butcher', 'water', 'gas', 'supermarket', 'retail', 'other']
    const storeTypes = [...STORE_BUSINESS_TYPES]

    const tenants = await client.fetch<Array<{ businessType: string }>>(
      `*[_type == "tenant" && (city == $city || lower(city) == lower($city)) && !deactivated && ((subscriptionExpiresAt != null && subscriptionExpiresAt > now()) || (subscriptionExpiresAt == null && (!defined(createdAt) || dateTime(createdAt) + 2592000 > now()))) && businessType in $storeTypes]{
        businessType
      }`,
      { city, storeTypes }
    )

    if (!tenants || tenants.length === 0) return Response.json([])

    const counts = new Map<string, number>()
    for (const t of tenants) {
      const type = (t?.businessType ?? '').trim()
      if (!type) continue
      counts.set(type, (counts.get(type) ?? 0) + 1)
    }

    const categoryDocs = await client.fetch<
      Array<{ _id: string; value: string; name_en: string; name_ar: string; image?: ImageSource; sortOrder?: number }>
    >(
      `*[_type == "businessCategory" && value in $storeTypes] | order(sortOrder asc) {
        _id,
        value,
        name_en,
        name_ar,
        image,
        sortOrder
      }`,
      { storeTypes }
    )

    const byType = new Map<string, { _id: string; value: string; name_en: string; name_ar: string; image?: ImageSource; sortOrder?: number }>()
    for (const doc of categoryDocs ?? []) {
      if (doc?.value) byType.set(doc.value, doc)
    }

    const result = displayOrder
      .filter((type) => (counts.get(type) ?? 0) > 0)
      .map((type) => {
        const doc = byType.get(type)
        const fallback = BUSINESS_TYPES.find((b) => b.value === type)
        const image = doc?.image
        return {
          _id: `storetype:${type}`,
          slug: type,
          title_en: doc?.name_en ?? fallback?.label ?? type,
          title_ar: doc?.name_ar ?? fallback?.labelAr ?? type,
          businessType: type,
          imageUrl: image?.asset?._ref ? urlFor(image).width(400).height(400).url() : null,
          tenantCount: counts.get(type) ?? 0,
        }
      })

    return Response.json(result)
  }

  const subcatFilter = category ? '&& businessType == $category' : ''

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

  const subcategories = await subcatReadClient.fetch<
    Array<{
      _id: string
      slug: { current?: string }
      title_en: string
      title_ar: string
      businessType: string
      image?: ImageSource
      sortOrder?: number
      lucideIcon?: string
    }>
  >(
    `*[_type == "businessSubcategory" && _id in $ids ${subcatFilter}] | order(sortOrder asc, title_en asc) {
      _id,
      "slug": slug.current,
      title_en,
      title_ar,
      businessType,
      image,
      sortOrder,
      lucideIcon
    }`,
    {
      ids: Array.from(usedSubcategoryIds),
      ...(category ? { category } : {}),
    }
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
        lucideIcon: s.lucideIcon?.trim() || null,
        tenantCount: tenantCountBySubcategory.get(s._id) ?? 0,
      }
    })

  return Response.json(result)
}
