import { NextRequest } from 'next/server'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'
import { suggestCorrection, type SearchableItem } from '@/lib/search/fuzzy-suggest'
import { getProductOrderCounts } from '@/lib/ai/product-order-counts'

/** Cache 60s per (city, country, q) to reduce Sanity API calls. */
export const revalidate = 60

type LogoSource = { asset?: { _ref: string } } | null | undefined
type ImageSource = { asset?: { _ref: string } } | null | undefined

const CITY_TENANT_FILTER = `(city == $city || lower(city) == lower($city)) && !deactivated && ((subscriptionExpiresAt != null && subscriptionExpiresAt > now()) || (subscriptionExpiresAt == null && (!defined(createdAt) || dateTime(createdAt) + 2592000 > now())))`

/**
 * GET /api/home/search?city=...&q=...&country=...
 * Returns businesses (priority 1) and products (priority 2) matching the search.
 * city: required. q: search query. country: optional.
 */
export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url)
  const city = (searchParams.get('city') ?? '').trim()
  const qRaw = (searchParams.get('q') ?? '').trim()
  const country = (searchParams.get('country') ?? '').trim()

  if (!city) {
    return Response.json({ error: 'city is required' }, { status: 400 })
  }

  const lang = (searchParams.get('lang') ?? 'en').toLowerCase() === 'ar' ? 'ar' : 'en'
  const q = qRaw.toLowerCase()
  const terms = q.split(/\s+/).filter(Boolean)

  // For multi-word (e.g. "3 pieces"), require each term to match (AND logic) for products.
  const productMatchFilter =
    terms.length > 0
      ? terms
          .map(
            (_, i) =>
              `(title_en match $term${i} || title_ar match $term${i} || category->title_en match $term${i} || category->title_ar match $term${i})`
          )
          .join(' && ')
      : 'true'

  const countryFilter = country ? '&& (country == $country || lower(country) == lower($country))' : ''
  const termParams: Record<string, string> = {}
  terms.forEach((t, i) => {
    termParams[`term${i}`] = `*${t}*`
  })
  const params: Record<string, string | number> = {
    city,
    ...(country ? { country } : {}),
    ...termParams,
  }

  type SubcategoryTitle = { title_en?: string | null; title_ar?: string | null }
  type TenantRow = {
    _id: string
    name: string
    name_en?: string | null
    name_ar?: string | null
    slug: string | { current?: string }
    businessType: string
    freeDeliveryEnabled?: boolean
    businessLogo?: LogoSource
    restaurantLogo?: LogoSource
    subcategoryTitles?: SubcategoryTitle[]
  }

  type ProductRow = {
    _id: string
    title_en?: string | null
    title_ar?: string | null
    image?: ImageSource
    price?: number
    currency?: string
    siteRef?: string
    siteName?: string
    siteSlug?: string
    siteBusinessLogo?: LogoSource
    restaurantLogo?: LogoSource
    categoryTitleEn?: string | null
    categoryTitleAr?: string | null
  }

  const rawTenants = await client.fetch<TenantRow[]>(
    `*[_type == "tenant" && ${CITY_TENANT_FILTER} ${countryFilter}] | order(name asc) {
      _id,
      name,
      "name_en": *[_type == "restaurantInfo" && site._ref == ^._id][0].name_en,
      "name_ar": *[_type == "restaurantInfo" && site._ref == ^._id][0].name_ar,
      "slug": slug.current,
      businessType,
      freeDeliveryEnabled,
      businessLogo,
      "restaurantLogo": *[_type == "restaurantInfo" && site._ref == ^._id][0].logo,
      "subcategoryTitles": *[_type == "businessSubcategory" && _id in ^.businessSubcategories[]._ref]{title_en, title_ar}
    }`,
    params
  )

  const tenants = rawTenants ?? []

  const businesses = (terms.length
    ? tenants.filter((t) => {
        const name = (t.name ?? '').toLowerCase()
        const nameEn = (t.name_en ?? '').toLowerCase()
        const nameAr = (t.name_ar ?? '').toLowerCase()
        const specialtyText = (t.subcategoryTitles ?? [])
          .map((s) => [s.title_en, s.title_ar].filter(Boolean).join(' '))
          .join(' ')
          .toLowerCase()
        return terms.every(
          (term) =>
            name.includes(term) ||
            nameEn.includes(term) ||
            nameAr.includes(term) ||
            specialtyText.includes(term)
        )
      })
    : tenants
  ).slice(0, 30)

  // Only return products that match the search keyword — not the full menu of matching businesses
  const productFilter = terms.length > 0 ? `(${productMatchFilter})` : 'true'

  const products = await (terms.length
    ? client.fetch<ProductRow[]>(
        `*[_type == "product" && defined(site) && (site._ref in *[_type == "tenant" && ${CITY_TENANT_FILTER} ${countryFilter}]._id) && ((isAvailable == true || isAvailable == null) || (isAvailable == false && availableAgainAt != null && now() > availableAgainAt)) && ${productFilter}] | order(site->name asc) [0...100] {
          _id,
          title_en,
          title_ar,
          image,
          price,
          currency,
          "siteRef": site._ref,
          "siteName": site->name,
          "siteSlug": site->slug.current,
          "siteBusinessLogo": site->businessLogo,
          "restaurantLogo": *[_type == "restaurantInfo" && site._ref == ^.site._ref][0].logo,
          "categoryTitleEn": category->title_en,
          "categoryTitleAr": category->title_ar
        }`,
        params
      )
    : Promise.resolve([]))

  const businessResult = businesses.map((t) => {
    const slug = typeof t.slug === 'string' ? t.slug : t.slug?.current ?? ''
    const logoSource =
      t.businessLogo?.asset?._ref ? t.businessLogo : t.restaurantLogo?.asset?._ref ? t.restaurantLogo : null
    const logoUrl = logoSource ? urlFor(logoSource).width(200).height(200).url() : null
    return {
      _id: t._id,
      name: t.name,
      name_en: t.name_en ?? null,
      name_ar: t.name_ar ?? null,
      slug,
      businessType: t.businessType,
      freeDeliveryEnabled: t.freeDeliveryEnabled === true,
      logoUrl,
    }
  })

  const orderCounts = terms.length > 0 ? await getProductOrderCounts(city, country || undefined) : new Map<string, number>()
  const productResultUnsorted = (products ?? []).map((p) => {
    const imageUrl = p.image?.asset?._ref
      ? urlFor(p.image).width(600).height(400).url()
      : null
    const logoSource =
      p.siteBusinessLogo?.asset?._ref
        ? p.siteBusinessLogo
        : p.restaurantLogo?.asset?._ref
          ? p.restaurantLogo
          : null
    const logoUrl = logoSource
      ? urlFor(logoSource).width(120).height(120).url()
      : null
    const categoryTitle =
      (p.categoryTitleEn ?? p.categoryTitleAr)
        ? { en: p.categoryTitleEn ?? null, ar: p.categoryTitleAr ?? null }
        : null
    return {
      _id: p._id,
      title_en: p.title_en ?? null,
      title_ar: p.title_ar ?? null,
      imageUrl,
      price: p.price ?? 0,
      currency: p.currency ?? 'ILS',
      orderCount: orderCounts.get(p._id),
      business: {
        name: p.siteName ?? '',
        slug: p.siteSlug ?? '',
        logoUrl,
      },
      category: categoryTitle,
    }
  })
  // Sort products by popularity (order count) — most ordered first
  const productResult = productResultUnsorted.sort((a, b) => (b.orderCount ?? 0) - (a.orderCount ?? 0))

  let didYouMean: string | null = null
  if (qRaw && businessResult.length === 0 && productResult.length === 0) {
    const businessItems: SearchableItem[] = tenants.map((t) => ({
      id: t._id,
      text: [t.name, t.name_en, t.name_ar].filter(Boolean).join(' ') || t._id,
      textEn: (t.name_en ?? t.name) || undefined,
      textAr: (t.name_ar ?? t.name) || undefined,
    }))
    const productItems: SearchableItem[] = (products ?? []).map((p) => ({
      id: p._id,
      text: [p.title_en, p.title_ar, p.categoryTitleEn, p.categoryTitleAr].filter(Boolean).join(' ') || p._id,
      textSecondary: undefined as string | undefined,
      textEn: (p.title_en ?? p.title_ar) || undefined,
      textAr: (p.title_ar ?? p.title_en) || undefined,
    }))
    let pool = [...businessItems, ...productItems]
    if (pool.length < 20) {
      const extra = await client.fetch<Array<{ _id: string; title_en?: string | null; title_ar?: string | null }>>(
        `*[_type == "product" && defined(site) && (site._ref in *[_type == "tenant" && ${CITY_TENANT_FILTER} ${countryFilter}]._id)] | order(site->name asc) [0...80] { _id, title_en, title_ar }`,
        { city, ...(country ? { country } : {}) }
      )
      pool = [
        ...pool,
        ...(extra ?? []).map((p) => ({
          id: p._id,
          text: [p.title_en, p.title_ar].filter(Boolean).join(' ') || p._id,
          textSecondary: undefined as string | undefined,
          textEn: (p.title_en ?? p.title_ar) || undefined,
          textAr: (p.title_ar ?? p.title_en) || undefined,
        })),
      ]
    }
    if (pool.length > 0) {
      didYouMean = suggestCorrection(qRaw, pool, { threshold: 0.5, limit: 5, preferLang: lang })
    }
  }

  return Response.json({
    businesses: businessResult,
    products: productResult,
    didYouMean,
  })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[api/home/search]', message, stack)
    return Response.json(
      { error: 'Search failed', message, ...(process.env.NODE_ENV === 'development' && { stack }) },
      { status: 500 }
    )
  }
}
