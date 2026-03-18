import { NextRequest } from 'next/server'
import { sanityFetch } from '@/sanity/lib/fetch'
import { urlFor } from '@/sanity/lib/image'
import { normalizeSectionKey } from '@/lib/section-key'

/** Cache 60s per (city, category, section, area) to reduce Sanity API calls. */
export const revalidate = 60

type LogoSource = { asset?: { _ref: string } } | null | undefined

function normalizeForMatch(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function areaMatches(a: string, b: string): boolean {
  const na = normalizeForMatch(a)
  const nb = normalizeForMatch(b)
  if (na === nb) return true
  if (na.length < 2 || nb.length < 2) return false
  const sa = na.replace(/\s/g, '')
  const sb = nb.replace(/\s/g, '')
  if (sa === sb) return true
  if (sa.includes(sb) || sb.includes(sa)) return true
  const ld = levenshtein(na, nb)
  const maxLen = Math.max(na.length, nb.length)
  return ld <= 1 || (maxLen <= 6 && ld <= 2)
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const d: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) d[i][0] = i
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    }
  }
  return d[m][n]
}

/**
 * GET /api/home/tenants?city=...&category=...&subcategory=...&section=...&area=...
 * Returns tenants in that city, optionally filtered.
 * Response: { tenants, meta: { availableSections, availableAreas, categoryCounts } }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const city = searchParams.get('city') ?? ''
  const category = searchParams.get('category') ?? ''
  const subcategory = searchParams.get('subcategory') ?? ''
  const section = searchParams.get('section') ?? ''
  const area = searchParams.get('area') ?? ''

  const subcategoryFilter = subcategory ? '&& $subcategory in businessSubcategories[]._ref' : ''
  // "stores" = everything except restaurant and cafe (markets, pharmacies, retail, bakery, other)
  const isStoresCategory = category === 'stores'
  const categoryFilter = category
    ? isStoresCategory
      ? '&& businessType != "restaurant" && businessType != "cafe"'
      : '&& businessType == $category'
    : ''
  const params: Record<string, string> = {
    city,
    ...(category && !isStoresCategory ? { category } : {}),
    ...(subcategory ? { subcategory } : {}),
  }

  const rawTenants = await sanityFetch<
    Array<{
      _id: string
      name: string
      name_en?: string | null
      name_ar?: string | null
      slug: { current?: string }
      businessType: string
      city?: string
      country?: string
      businessLogo?: LogoSource
      restaurantLogo?: LogoSource
      categories?: Array<{ title_en?: string; title_ar?: string }>
      businessSubcategories?: Array<{ _id: string; title_en?: string; title_ar?: string; slug?: { current?: string } }>
      popularProducts?: Array<{ title_en?: string; title_ar?: string }>
      areas?: Array<{ name_en?: string; name_ar?: string }>
    }>
  >(
    `*[_type == "tenant" && (city == $city || lower(city) == lower($city)) && !deactivated && ((subscriptionExpiresAt != null && subscriptionExpiresAt > now()) || (subscriptionExpiresAt == null && (!defined(createdAt) || dateTime(createdAt) + 2592000 > now()))) ${categoryFilter} ${subcategoryFilter}] | order(name asc) {
      _id,
      name,
      "name_en": *[_type == "restaurantInfo" && site._ref == ^._id][0].name_en,
      "name_ar": *[_type == "restaurantInfo" && site._ref == ^._id][0].name_ar,
      "slug": slug.current,
      businessType,
      city,
      country,
      businessLogo,
      "restaurantLogo": *[_type == "restaurantInfo" && site._ref == ^._id][0].logo,
      "categories": *[_type == "category" && site._ref == ^._id] | order(sortOrder asc) { title_en, title_ar },
      "businessSubcategories": businessSubcategories[]->{ _id, title_en, title_ar, "slug": slug.current },
      "popularProducts": *[_type == "product" && (site._ref == ^._id || !defined(site)) && isPopular == true && ((isAvailable == true || isAvailable == null) || (isAvailable == false && availableAgainAt != null && now() > availableAgainAt))] | order(sortOrder asc) [0...3] { title_en, title_ar },
      "areas": *[_type == "area" && site._ref == ^._id && isActive == true] | order(sortOrder asc) { name_en, name_ar }
    }`,
    params,
    { revalidate: 60, tag: 'home-tenants' }
  )

  let tenants = rawTenants ?? []

  if (section) {
    const sectionNorm = normalizeSectionKey(section)
    tenants = tenants.filter((t) =>
      (t.categories ?? []).some((c) => {
        const en = (c.title_en ?? '').trim()
        const ar = (c.title_ar ?? '').trim()
        const catNorm = normalizeForMatch(en || ar)
        if (!catNorm) return false
        if (sectionNorm === catNorm) return true
        if (sectionNorm.includes(catNorm) || catNorm.includes(sectionNorm)) return true
        // Plural/singular: "sandwich" matches "Sandwiches", "sandwiches" matches "Sandwich"
        if (sectionNorm + 's' === catNorm || catNorm + 's' === sectionNorm) return true
        return false
      })
    )
  }

  if (area) {
    tenants = tenants.filter((t) =>
      (t.areas ?? []).some((a) => {
        const en = (a.name_en ?? '').trim()
        const ar = (a.name_ar ?? '').trim()
        return areaMatches(en, area) || areaMatches(ar, area) || areaMatches(area, en) || areaMatches(area, ar)
      })
    )
  }

  const categoryCounts: Record<string, number> = {}
  let storesCount = 0
  for (const t of rawTenants ?? []) {
    const bt = t.businessType ?? ''
    if (bt) {
      categoryCounts[bt] = (categoryCounts[bt] ?? 0) + 1
      if (bt !== 'restaurant' && bt !== 'cafe') storesCount++
    }
  }
  if (storesCount > 0) categoryCounts['stores'] = storesCount

  const availableSubcategories = new Map<
    string,
    { _id: string; en: string; ar: string }
  >()
  for (const t of rawTenants ?? []) {
    for (const s of t.businessSubcategories ?? []) {
      if (!s?._id) continue
      const en = (s.title_en ?? '').trim()
      const ar = (s.title_ar ?? '').trim()
      if (en || ar) {
        if (!availableSubcategories.has(s._id)) {
          availableSubcategories.set(s._id, { _id: s._id, en, ar })
        }
      }
    }
  }

  const availableAreasList: Array<{ name_en: string; name_ar: string; key: string }> = []
  const seenAreaKeys = new Set<string>()
  for (const t of rawTenants ?? []) {
    for (const a of t.areas ?? []) {
      const en = (a.name_en ?? '').trim()
      const ar = (a.name_ar ?? '').trim()
      if (en || ar) {
        const key = normalizeForMatch(en || ar)
        if (!seenAreaKeys.has(key)) {
          seenAreaKeys.add(key)
          availableAreasList.push({ name_en: en, name_ar: ar, key })
        }
      }
    }
  }
  availableAreasList.sort((a, b) => (a.name_en || a.name_ar).localeCompare(b.name_en || b.name_ar))

  const result = tenants.map((t) => {
    const slug = typeof t.slug === 'string' ? t.slug : null
    const logoSource = t.businessLogo?.asset?._ref ? t.businessLogo : t.restaurantLogo?.asset?._ref ? t.restaurantLogo : null
    const logoUrl = logoSource ? urlFor(logoSource).width(200).height(200).url() : null
    const sections = (t.businessSubcategories ?? [])
      .map((s) => ({ en: (s?.title_en ?? '').trim(), ar: (s?.title_ar ?? '').trim() }))
      .filter((x) => x.en || x.ar)
      .slice(0, 5)
    const popularItems = (t.popularProducts ?? [])
      .map((p) => ({ en: (p?.title_en ?? '').trim(), ar: (p?.title_ar ?? '').trim() }))
      .filter((x) => x.en || x.ar)
      .slice(0, 3)

    return {
      _id: t._id,
      name: t.name,
      name_en: t.name_en ?? null,
      name_ar: t.name_ar ?? null,
      slug: slug ?? '',
      businessType: t.businessType,
      logoUrl,
      sections,
      popularItems,
    }
  })

  return Response.json({
    tenants: result,
    meta: {
      availableSubcategories: Array.from(availableSubcategories.values()),
      availableAreas: availableAreasList,
      categoryCounts,
    },
  })
}
