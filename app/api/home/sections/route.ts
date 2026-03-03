import { NextRequest } from 'next/server'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'

/** Cache 60s per (city, category) to reduce Sanity API calls. */
export const revalidate = 60

type ImageSource = { asset?: { _ref: string } } | null | undefined

/**
 * Pick one image from candidates, rotating by hour for freshness.
 * Different restaurants' images will show over time for the same section.
 */
function pickFreshImage(candidates: ImageSource[]): ImageSource | null {
  const valid = candidates.filter((c): c is ImageSource & { asset: { _ref: string } } =>
    !!(c && c.asset?._ref)
  )
  if (valid.length === 0) return null
  const hour = Math.floor(Date.now() / 3600000)
  const index = hour % valid.length
  return valid[index] ?? valid[0] ?? null
}

/**
 * GET /api/home/sections?city=Jerusalem&category=restaurant
 * Returns specialties derived from menu category titles (sections) used by tenants.
 * Uses subcategory image when available; otherwise category or product image from a tenant.
 * Rotates between multiple restaurants' images for freshness.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const city = searchParams.get('city') ?? ''
  const categoryParam = searchParams.get('category') ?? ''

  const { categoriesWithImages, subcategoriesInUse, tenantsWithSubs } = await client.fetch<{
    categoriesWithImages: Array<{
      _id: string
      title_en?: string
      title_ar?: string
      image?: ImageSource
      siteRef?: string
      sampleProductImage?: ImageSource
    }>
    subcategoriesInUse: Array<{
      _id: string
      title_en: string
      title_ar: string
      businessType: string
      image?: ImageSource
      sortOrder?: number
    }>
    tenantsWithSubs: Array<{ _id: string; businessSubcategoryIds: string[] }>
  }>(
    `{
      "categoriesWithImages": *[_type == "category" && site._ref in *[_type == "tenant" && (city == $city || lower(city) == lower($city)) && !deactivated && ((subscriptionExpiresAt != null && subscriptionExpiresAt > now()) || (subscriptionExpiresAt == null && (!defined(createdAt) || dateTime(createdAt) + 2592000 > now()))) ${
        categoryParam ? '&& businessType == $category' : ''
      }]._id] | order(site->name asc) {
        _id,
        title_en,
        title_ar,
        image,
        "siteRef": site._ref,
        "sampleProductImage": *[_type == "product" && references(^._id) && defined(image)][0].image
      },
      "subcategoriesInUse": *[_type == "businessSubcategory" ${
        categoryParam ? '&& businessType == $category' : ''
      }] | order(sortOrder asc, title_en asc) {
        _id,
        title_en,
        title_ar,
        businessType,
        image,
        sortOrder
      },
      "tenantsWithSubs": *[_type == "tenant" && (city == $city || lower(city) == lower($city)) && !deactivated && ((subscriptionExpiresAt != null && subscriptionExpiresAt > now()) || (subscriptionExpiresAt == null && (!defined(createdAt) || dateTime(createdAt) + 2592000 > now()))) && count(businessSubcategories) > 0 ${
        categoryParam ? '&& businessType == $category' : ''
      }] { _id, "businessSubcategoryIds": businessSubcategories[]._ref }
    }`,
    { city, ...(categoryParam ? { category: categoryParam } : {}) }
  )

  const sectionMap = new Map<
    string,
    { en: string; ar: string; count: number; subcategoryImage?: ImageSource; candidateImages: ImageSource[] }
  >()

  function normalizeTitle(s: string): string {
    return (s ?? '').trim().toLowerCase()
  }

  for (const c of categoriesWithImages ?? []) {
    const en = (c.title_en ?? '').trim()
    const ar = (c.title_ar ?? '').trim()
    if (!en && !ar) continue
    const key = normalizeTitle(en || ar)
    if (!key) continue
    const existing = sectionMap.get(key)
    const img = c.image ?? c.sampleProductImage
    if (img?.asset?._ref) {
      if (existing) {
        existing.count += 1
        existing.candidateImages.push(img)
      } else {
        sectionMap.set(key, { en, ar, count: 1, candidateImages: [img] })
      }
    } else {
      if (existing) {
        existing.count += 1
      } else {
        sectionMap.set(key, { en, ar, count: 1, candidateImages: [] })
      }
    }
  }

  const usedSubcategoryIds = new Set<string>()
  const tenantCountBySubcategory = new Map<string, number>()
  for (const t of tenantsWithSubs ?? []) {
    for (const id of t.businessSubcategoryIds ?? []) {
      if (id) {
        usedSubcategoryIds.add(id)
        tenantCountBySubcategory.set(id, (tenantCountBySubcategory.get(id) ?? 0) + 1)
      }
    }
  }

  for (const s of subcategoriesInUse ?? []) {
    if (!usedSubcategoryIds.has(s._id)) continue
    const en = (s.title_en ?? '').trim()
    const ar = (s.title_ar ?? '').trim()
    if (!en && !ar) continue
    const key = normalizeTitle(en || ar)
    const count = tenantCountBySubcategory.get(s._id) ?? 0
    const existing = sectionMap.get(key)
    if (existing) {
      existing.count = Math.max(existing.count, count)
      existing.subcategoryImage = s.image
    } else {
      sectionMap.set(key, {
        en,
        ar,
        count,
        subcategoryImage: s.image,
        candidateImages: [],
      })
    }
  }

  const result = Array.from(sectionMap.entries())
    .filter(([, v]) => v.count > 0)
    .map(([key, v]) => {
      const image =
        v.subcategoryImage?.asset?._ref
          ? v.subcategoryImage
          : pickFreshImage(v.candidateImages)
      return {
        key,
        title_en: v.en,
        title_ar: v.ar,
        tenantCount: v.count,
        imageUrl: image?.asset?._ref ? urlFor(image).width(400).height(400).url() : null,
      }
    })
    .sort((a, b) => b.tenantCount - a.tenantCount)

  return Response.json(result)
}
