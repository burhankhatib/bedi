/**
 * Tool implementations for the AI search agent.
 * Fetches businesses and products from Sanity for RAG / tool results.
 */
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'

const CITY_TENANT_FILTER = `(city == $city || lower(city) == lower($city)) && !deactivated && ((subscriptionExpiresAt != null && subscriptionExpiresAt > now()) || (subscriptionExpiresAt == null && (!defined(createdAt) || dateTime(createdAt) + 2592000 > now())))`

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
  isPopular?: boolean
}

export type ToolBusiness = {
  _id: string
  name: string
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
}): Promise<SearchProductsResult> {
  const { city, country = '', query, limit = 30 } = params
  const q = query.toLowerCase().trim()
  const terms = q.split(/\s+/).filter(Boolean)

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

  type TenantRow = { _id: string; name: string; slug: string | { current?: string }; businessType: string; businessLogo?: ImageSource; restaurantLogo?: ImageSource }
  type ProductRow = {
    _id: string
    title_en?: string | null
    title_ar?: string | null
    image?: ImageSource
    price?: number
    currency?: string
    isPopular?: boolean
    siteName?: string
    siteSlug?: string
    siteBusinessLogo?: ImageSource
    restaurantLogo?: ImageSource
  }

  const [tenants, products] = await Promise.all([
    client.fetch<TenantRow[]>(
      `*[_type == "tenant" && ${CITY_TENANT_FILTER} ${countryFilter}] | order(name asc) [0...20] {
        _id, name, "slug": slug.current, businessType, businessLogo,
        "restaurantLogo": *[_type == "restaurantInfo" && site._ref == ^._id][0].logo
      }`,
      sanityParams
    ),
    terms.length
      ? client.fetch<ProductRow[]>(
          `*[_type == "product" && defined(site) && (site._ref in *[_type == "tenant" && ${CITY_TENANT_FILTER} ${countryFilter}]._id) && ((isAvailable == true || isAvailable == null) || (isAvailable == false && availableAgainAt != null && now() > availableAgainAt)) && ${productMatchFilter}] | order(isPopular desc, site->name asc) [0...${limit}] {
            _id, title_en, title_ar, image, price, currency, isPopular,
            "siteName": site->name, "siteSlug": site->slug.current,
            "siteBusinessLogo": site->businessLogo,
            "restaurantLogo": *[_type == "restaurantInfo" && site._ref == ^.site._ref][0].logo
          }`,
          sanityParams
        )
      : Promise.resolve([]),
  ])

  const tenantList = tenants ?? []
  const businesses: ToolBusiness[] = (terms.length
    ? tenantList.filter((t) => {
        const name = (t.name ?? '').toLowerCase()
        return terms.some((term) => name.includes(term))
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
        slug,
        businessType: t.businessType ?? 'restaurant',
        logoUrl,
      }
    })

  const productList = (products ?? []).slice(0, limit)
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
      isPopular: p.isPopular ?? false,
    }
  })

  return { products: productResults, businesses }
}

export async function searchIngredients(params: {
  city: string
  country?: string
  ingredients: string[]
  lang?: 'en' | 'ar'
}): Promise<{ products: ToolProduct[]; byStore: Record<string, ToolProduct[]> }> {
  const { city, country = '', ingredients, lang = 'en' } = params
  if (ingredients.length === 0) return { products: [], byStore: {} }

  const matchClauses = ingredients
    .slice(0, 15)
    .map(
      (_, i) =>
        `(title_en match $ing${i} || title_ar match $ing${i} || description_en match $ing${i} || description_ar match $ing${i})`
    )
    .join(' || ')

  const countryFilter = country ? '&& (country == $country || lower(country) == lower($country))' : ''
  const ingParams: Record<string, string> = {}
  ingredients.slice(0, 15).forEach((ing, i) => {
    ingParams[`ing${i}`] = `*${ing.trim().toLowerCase()}*`
  })

  type ProductRow = {
    _id: string
    title_en?: string | null
    title_ar?: string | null
    image?: ImageSource
    price?: number
    currency?: string
    siteName?: string
    siteSlug?: string
    siteBusinessLogo?: ImageSource
    restaurantLogo?: ImageSource
  }

  const products = await client.fetch<ProductRow[]>(
    `*[_type == "product" && defined(site) && (site._ref in *[_type == "tenant" && ${CITY_TENANT_FILTER} ${countryFilter}]._id) && ((isAvailable == true || isAvailable == null) || (isAvailable == false && availableAgainAt != null && now() > availableAgainAt)) && (${matchClauses})] | order(site->name asc) [0...50] {
      _id, title_en, title_ar, image, price, currency,
      "siteName": site->name, "siteSlug": site->slug.current,
      "siteBusinessLogo": site->businessLogo,
      "restaurantLogo": *[_type == "restaurantInfo" && site._ref == ^.site._ref][0].logo
    }`,
    { city, ...(country ? { country } : {}), ...ingParams }
  )

  const list = (products ?? []).map((p) => {
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
    }
  })

  const byStore: Record<string, ToolProduct[]> = {}
  for (const p of list) {
    const key = p.businessSlug || 'unknown'
    if (!byStore[key]) byStore[key] = []
    byStore[key].push(p)
  }

  return { products: list, byStore }
}
