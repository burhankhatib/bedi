/**
 * Tool implementations for the AI search agent.
 * Fetches businesses and products from Sanity for RAG / tool results.
 */
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'
import { getBusinessHoursForCity } from '@/lib/ai/business-hours-helper'
import { getProductOrderCounts } from '@/lib/ai/product-order-counts'

const CITY_TENANT_FILTER = `(city == $city || lower(city) == lower($city)) && !deactivated && ((subscriptionExpiresAt != null && subscriptionExpiresAt > now()) || (subscriptionExpiresAt == null && (!defined(createdAt) || dateTime(createdAt) + 2592000 > now())))`

/** Business types that sell ingredients (grocery/market). Excludes restaurants, cafes, bakeries. */
const INGREDIENT_BUSINESS_TYPES = ['grocery', 'supermarket', 'greengrocer', 'retail', 'pharmacy']

type ImageSource = { asset?: { _ref: string } } | null | undefined

export type ToolProduct = {
  _id: string
  title_en: string | null
  title_ar: string | null
  price: number
  currency: string
  imageUrl: string | null
  businessSlug: string
  businessName: string
  /** Arabic business name. Use when lang is ar. */
  businessName_ar?: string | null
  businessType?: string
  isPopular?: boolean
  /** Whether the business is currently open */
  businessOpenNow?: boolean
  /** Number of times this product was ordered (for popularity sort) */
  orderCount?: number
}

export type ToolBusiness = {
  _id: string
  name: string
  /** Arabic display name (from restaurantInfo or tenant). Use when lang is ar. */
  name_ar?: string | null
  slug: string
  businessType: string
  logoUrl: string | null
}

export type SearchProductsResult = {
  products: ToolProduct[]
  businesses: ToolBusiness[]
}

export async function searchProducts(params: {
  city: string
  country?: string
  query: string
  limit?: number
  /** Prefer products from businesses that are currently open */
  preferOpenOnly?: boolean
  /** Sort: price_asc (cheapest first), price_desc, popularity (most ordered first) */
  sortBy?: 'price_asc' | 'price_desc' | 'popularity'
  /** Filter by business type (e.g. greengrocer for خضار وفواكه) */
  businessType?: string
}): Promise<SearchProductsResult> {
  const { city, country = '', query, limit = 30, preferOpenOnly, sortBy, businessType } = params
  const q = query.toLowerCase().trim()
  const terms = q.split(/\s+/).filter(Boolean)

  const businessTypeFilter = businessType ? `&& businessType == $businessType` : ''
  const businessTypeParam = businessType ? { businessType } : {}

  const productMatchFilter =
    terms.length > 0
      ? terms
          .map(
            (_, i) =>
              `(title_en match $term${i} || title_ar match $term${i} || description_en match $term${i} || description_ar match $term${i} || category->title_en match $term${i} || category->title_ar match $term${i})`
          )
          .join(' && ')
      : 'true'

  const countryFilter = country ? '&& (country == $country || lower(country) == lower($country))' : ''
  const termParams: Record<string, string> = {}
  terms.forEach((t, i) => {
    termParams[`term${i}`] = `*${t}*`
  })
  const sanityParams: Record<string, string | number> = {
    city,
    ...(country ? { country } : {}),
    ...termParams,
  }

  type TenantRow = {
    _id: string
    name: string
    name_ar?: string | null
    slug: string | { current?: string }
    businessType: string
    businessLogo?: ImageSource
    restaurantLogo?: ImageSource
  }
  type ProductRow = {
    _id: string
    title_en?: string | null
    title_ar?: string | null
    image?: ImageSource
    price?: number
    currency?: string
    isPopular?: boolean
    siteName?: string
    siteName_ar?: string | null
    siteSlug?: string
    siteBusinessType?: string
    siteBusinessLogo?: ImageSource
    restaurantLogo?: ImageSource
  }

  const tenantParams = { ...sanityParams, ...businessTypeParam }
  const [tenants, products] = await Promise.all([
    client.fetch<TenantRow[]>(
      `*[_type == "tenant" && ${CITY_TENANT_FILTER} ${countryFilter} ${businessTypeFilter}] | order(name asc) [0...20] {
        _id, name,
        "name_ar": coalesce(*[_type == "restaurantInfo" && site._ref == ^._id][0].name_ar, name_ar, name),
        "slug": slug.current, businessType, businessLogo,
        "restaurantLogo": *[_type == "restaurantInfo" && site._ref == ^._id][0].logo
      }`,
      tenantParams
    ),
    terms.length || businessType
      ? client.fetch<ProductRow[]>(
          `*[_type == "product" && defined(site) && (site._ref in *[_type == "tenant" && ${CITY_TENANT_FILTER} ${countryFilter} ${businessTypeFilter}]._id) && ((isAvailable == true || isAvailable == null) || (isAvailable == false && availableAgainAt != null && now() > availableAgainAt)) && ${productMatchFilter}] | order(isPopular desc, site->name asc) [0...${limit}] {
            _id, title_en, title_ar, image, price, currency, isPopular,
            "siteName": site->name,
            "siteName_ar": coalesce(*[_type == "restaurantInfo" && site._ref == ^.site._ref][0].name_ar, site->name_ar, site->name),
            "siteSlug": site->slug.current, "siteBusinessType": site->businessType,
            "siteBusinessLogo": site->businessLogo,
            "restaurantLogo": *[_type == "restaurantInfo" && site._ref == ^.site._ref][0].logo
          }`,
          { ...sanityParams, ...businessTypeParam }
        )
      : Promise.resolve([]),
  ])

  const tenantList = tenants ?? []
  const businesses: ToolBusiness[] = (terms.length
    ? tenantList.filter((t) => {
        const name = (t.name ?? '').toLowerCase()
        const nameAr = (t.name_ar ?? '').toLowerCase()
        return terms.some((term) => name.includes(term) || nameAr.includes(term))
      })
    : tenantList
  )
    .slice(0, 20)
    .map((t) => {
      const slug = typeof t.slug === 'string' ? t.slug : t.slug?.current ?? ''
      const logoSource = t.businessLogo?.asset?._ref ? t.businessLogo : t.restaurantLogo?.asset?._ref ? t.restaurantLogo : null
      const logoUrl = logoSource ? urlFor(logoSource).width(120).height(120).url() : null
      return {
        _id: t._id,
        name: t.name ?? '',
        name_ar: t.name_ar ?? null,
        slug,
        businessType: t.businessType ?? 'restaurant',
        logoUrl,
      }
    })

  let productList = (products ?? []).slice(0, limit * 2)
  const [hoursList, orderCounts] = await Promise.all([
    getBusinessHoursForCity(city, country || undefined),
    sortBy === 'popularity' ? getProductOrderCounts(city, country || undefined) : Promise.resolve(new Map<string, number>()),
  ])
  const openBySlug = new Map(hoursList.map((h) => [h.slug, h.isOpenNow]))

  if (preferOpenOnly) {
    const openSlugs = new Set(hoursList.filter((h) => h.isOpenNow).map((h) => h.slug))
    productList = productList.filter((p) => openSlugs.has(p.siteSlug ?? ''))
  }

  const productResults: ToolProduct[] = productList.map((p) => {
    const imageUrl = p.image?.asset?._ref ? urlFor(p.image).width(300).height(300).url() : null
    return {
      _id: p._id,
      title_en: p.title_en ?? null,
      title_ar: p.title_ar ?? null,
      price: p.price ?? 0,
      currency: p.currency ?? 'ILS',
      imageUrl,
      businessSlug: p.siteSlug ?? '',
      businessName: p.siteName ?? '',
      businessName_ar: p.siteName_ar ?? null,
      businessType: p.siteBusinessType ?? undefined,
      isPopular: p.isPopular ?? false,
      businessOpenNow: openBySlug.get(p.siteSlug ?? ''),
      orderCount: orderCounts.get(p._id),
    }
  })

  if (sortBy === 'price_asc') productResults.sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
  else if (sortBy === 'price_desc') productResults.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
  else if (sortBy === 'popularity') productResults.sort((a, b) => (b.orderCount ?? 0) - (a.orderCount ?? 0))

  return { products: productResults.slice(0, limit), businesses }
}

/** Product is relevant if its title contains at least one ingredient (avoids suggesting cheese when user asked for chicken). */
function isProductRelevantForIngredients(
  p: { title_en?: string | null; title_ar?: string | null },
  ingredients: string[]
): boolean {
  const title = `${(p.title_en ?? '').toLowerCase()} ${(p.title_ar ?? '').toLowerCase()}`
  return ingredients.some((ing) => {
    const term = ing.trim().toLowerCase()
    return term.length > 1 && title.includes(term)
  })
}

export type StoreOption = { slug: string; name: string; name_ar: string | null; productCount: number }

export async function searchIngredients(params: {
  city: string
  country?: string
  ingredients: string[]
  lang?: 'en' | 'ar'
  preferOpenOnly?: boolean
  sortBy?: 'price_asc' | 'popularity'
  /** When set, return only products from this store (for post–store-choice flow). */
  storeSlug?: string
}): Promise<{
  products: ToolProduct[]
  byStore: Record<string, ToolProduct[]>
  storeOptions: StoreOption[]
  soughtIngredients: string[]
  matchedIngredients: string[]
  missingIngredients: string[]
}> {
  const { city, country = '', preferOpenOnly, sortBy, storeSlug } = params
  const sought = params.ingredients.slice(0, 15).map((i) => i.trim()).filter(Boolean)
  if (sought.length === 0)
    return { products: [], byStore: {}, storeOptions: [], soughtIngredients: [], matchedIngredients: [], missingIngredients: [] }

  const matchClauses = sought
    .map(
      (_, i) =>
        `(title_en match $ing${i} || title_ar match $ing${i} || description_en match $ing${i} || description_ar match $ing${i})`
    )
    .join(' || ')

  const countryFilter = country ? '&& (country == $country || lower(country) == lower($country))' : ''
  const ingParams: Record<string, string> = {}
  sought.forEach((ing, i) => {
    ingParams[`ing${i}`] = `*${ing.toLowerCase()}*`
  })

  type ProductRow = {
    _id: string
    title_en?: string | null
    title_ar?: string | null
    image?: ImageSource
    price?: number
    currency?: string
    siteName?: string
    siteName_ar?: string | null
    siteSlug?: string
    siteBusinessLogo?: ImageSource
    restaurantLogo?: ImageSource
  }

  const ingredientTenantFilter = `(site._ref in *[_type == "tenant" && ${CITY_TENANT_FILTER} ${countryFilter} && businessType in $ingredientTypes]._id)`
  const products = await client.fetch<ProductRow[]>(
    `*[_type == "product" && defined(site) && ${ingredientTenantFilter} && ((isAvailable == true || isAvailable == null) || (isAvailable == false && availableAgainAt != null && now() > availableAgainAt)) && (${matchClauses})] | order(site->name asc) [0...50] {
      _id, title_en, title_ar, image, price, currency,
      "siteName": site->name,
      "siteName_ar": coalesce(*[_type == "restaurantInfo" && site._ref == ^.site._ref][0].name_ar, site->name_ar, site->name),
      "siteSlug": site->slug.current,
      "siteBusinessLogo": site->businessLogo,
      "restaurantLogo": *[_type == "restaurantInfo" && site._ref == ^.site._ref][0].logo
    }`,
    { city, ingredientTypes: INGREDIENT_BUSINESS_TYPES, ...(country ? { country } : {}), ...ingParams }
  )

  const [hoursList, orderCounts] = await Promise.all([
    getBusinessHoursForCity(city, country || undefined),
    sortBy === 'popularity' ? getProductOrderCounts(city, country || undefined) : Promise.resolve(new Map<string, number>()),
  ])
  const openBySlug = new Map(hoursList.map((h) => [h.slug, h.isOpenNow]))

  let rawList = (products ?? []).map((p) => {
    const imageUrl = p.image?.asset?._ref ? urlFor(p.image).width(300).height(300).url() : null
    return {
      _id: p._id,
      title_en: p.title_en ?? null,
      title_ar: p.title_ar ?? null,
      price: p.price ?? 0,
      currency: p.currency ?? 'ILS',
      imageUrl,
      businessSlug: p.siteSlug ?? '',
      businessName: p.siteName ?? '',
      businessName_ar: p.siteName_ar ?? null,
      businessOpenNow: openBySlug.get(p.siteSlug ?? ''),
      orderCount: orderCounts.get(p._id),
    }
  })

  if (preferOpenOnly) {
    const openSlugs = new Set(hoursList.filter((h) => h.isOpenNow).map((h) => h.slug))
    rawList = rawList.filter((p) => openSlugs.has(p.businessSlug))
  }

  let list = rawList.filter((p) => isProductRelevantForIngredients(p, sought))

  // Filter to single store when user has chosen one
  if (storeSlug) {
    list = list.filter((p) => (p.businessSlug || '') === storeSlug)
  }

  if (sortBy === 'price_asc') list = [...list].sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
  else if (sortBy === 'popularity') list = [...list].sort((a, b) => (b.orderCount ?? 0) - (a.orderCount ?? 0))

  const matchedIngredients = sought.filter((ing) => list.some((p) => isProductRelevantForIngredients(p, [ing])))
  const missingIngredients = sought.filter((ing) => !matchedIngredients.some((m) => m.trim().toLowerCase() === ing.trim().toLowerCase()))

  // Build byStore before deduplication (for storeOptions)
  const byStoreRaw: Record<string, ToolProduct[]> = {}
  for (const p of list) {
    const key = p.businessSlug || 'unknown'
    if (!byStoreRaw[key]) byStoreRaw[key] = []
    byStoreRaw[key].push(p)
  }

  // Deduplicate: ONE product per ingredient. Prefer store that covers the most ingredients.
  const ingredientToProducts = new Map<string, ToolProduct[]>()
  for (const ing of matchedIngredients) {
    const prods = list.filter((p) => isProductRelevantForIngredients(p, [ing]))
    if (prods.length > 0) ingredientToProducts.set(ing, prods)
  }

  const storeCoverage = new Map<string, number>()
  for (const [ing, prods] of ingredientToProducts) {
    const storesForIng = new Set(prods.map((p) => p.businessSlug || 'unknown'))
    for (const slug of storesForIng) {
      storeCoverage.set(slug, (storeCoverage.get(slug) ?? 0) + 1)
    }
  }
  const storeOrder = [...storeCoverage.entries()]
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([slug]) => slug)

  const picked = new Set<string>()
  const deduped: ToolProduct[] = []
  for (const ing of matchedIngredients) {
    const prods = ingredientToProducts.get(ing) ?? []
    if (prods.length === 0) continue
    const sorted = [...prods].sort((a, b) => {
      const aIdx = storeOrder.indexOf(a.businessSlug || '')
      const bIdx = storeOrder.indexOf(b.businessSlug || '')
      if (aIdx !== bIdx) return aIdx - bIdx
      if (sortBy === 'price_asc') return (a.price ?? 0) - (b.price ?? 0)
      if (sortBy === 'popularity') return (b.orderCount ?? 0) - (a.orderCount ?? 0)
      return 0
    })
    const best = sorted[0]
    if (best && !picked.has(best._id)) {
      picked.add(best._id)
      deduped.push(best)
    }
  }

  const byStore: Record<string, ToolProduct[]> = {}
  for (const p of deduped) {
    const key = p.businessSlug || 'unknown'
    if (!byStore[key]) byStore[key] = []
    byStore[key].push(p)
  }

  const storeOptions: StoreOption[] = Object.entries(byStoreRaw)
    .filter(([slug]) => storeCoverage.has(slug))
    .map(([slug, prods]) => ({
      slug,
      name: prods[0]?.businessName ?? slug,
      name_ar: prods[0]?.businessName_ar ?? null,
      productCount: storeCoverage.get(slug) ?? 0,
    }))

  return {
    products: deduped,
    byStore,
    storeOptions,
    soughtIngredients: sought,
    matchedIngredients,
    missingIngredients,
  }
}
