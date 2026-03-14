/**
 * Build RAG context from Sanity for the AI search agent.
 * Uses existing search API logic to keep token usage low.
 */
import { client } from '@/sanity/lib/client'
import { getBusinessHoursForCity } from '@/lib/ai/business-hours-helper'

const CITY_TENANT_FILTER = `(city == $city || lower(city) == lower($city)) && !deactivated && ((subscriptionExpiresAt != null && subscriptionExpiresAt > now()) || (subscriptionExpiresAt == null && (!defined(createdAt) || dateTime(createdAt) + 2592000 > now())))`

export type SearchContextInput = {
  city: string
  country?: string
  query: string
  lang: 'en' | 'ar'
  /** Max businesses + products to include (keeps tokens low) */
  limit?: number
}

export type BusinessContext = {
  name: string
  slug: string
  businessType: string
}

export type ProductContext = {
  _id: string
  title: string
  price: number
  currency: string
  businessSlug: string
  businessName: string
  description?: string
  isPopular?: boolean
  ingredients?: string[]
}

export type SearchContext = {
  businesses: BusinessContext[]
  products: ProductContext[]
  /** Concise text for LLM context */
  contextText: string
}

export async function buildSearchContext(input: SearchContextInput): Promise<SearchContext> {
  const { city, country = '', query, lang, limit = 40 } = input
  const q = query.toLowerCase().trim()
  const terms = q.split(/\s+/).filter(Boolean)

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

  type TenantRow = { _id: string; name: string; slug: string | { current?: string }; businessType: string }
  type ProductRow = {
    _id: string
    title_en?: string | null
    title_ar?: string | null
    description_en?: string | null
    description_ar?: string | null
    ingredients_en?: string[] | null
    ingredients_ar?: string[] | null
    price?: number
    currency?: string
    siteName?: string
    siteSlug?: string
    isPopular?: boolean
  }

  const [tenants, products] = await Promise.all([
    client.fetch<TenantRow[]>(
      `*[_type == "tenant" && ${CITY_TENANT_FILTER} ${countryFilter}] | order(name asc) [0...15] {
        _id, name, "slug": slug.current, businessType
      }`,
      params
    ),
    terms.length
      ? client.fetch<ProductRow[]>(
          `*[_type == "product" && defined(site) && (site._ref in *[_type == "tenant" && ${CITY_TENANT_FILTER} ${countryFilter}]._id) && ((isAvailable == true || isAvailable == null) || (isAvailable == false && availableAgainAt != null && now() > availableAgainAt)) && ${productMatchFilter}] | order(site->name asc) [0...30] {
            _id, title_en, title_ar, description_en, description_ar, ingredients_en, ingredients_ar, price, currency, isPopular,
            "siteName": site->name, "siteSlug": site->slug.current
          }`,
          params
        )
      : Promise.resolve([]),
  ])

  const tenantList = tenants ?? []
  const businesses: BusinessContext[] = (terms.length
    ? tenantList.filter((t) => {
        const name = (t.name ?? '').toLowerCase()
        return terms.some((term) => name.includes(term))
      })
    : tenantList
  ).slice(0, 15).map((t) => ({
    name: t.name ?? '',
    slug: typeof t.slug === 'string' ? t.slug : t.slug?.current ?? '',
    businessType: t.businessType ?? 'restaurant',
  }))

  const productList = (products ?? []).slice(0, 30)
  const productContexts: ProductContext[] = productList.map((p) => {
    const title = lang === 'ar' ? (p.title_ar ?? p.title_en) : (p.title_en ?? p.title_ar)
    const desc = lang === 'ar' ? (p.description_ar ?? p.description_en) : (p.description_en ?? p.description_ar)
    const ingredients = lang === 'ar' ? (p.ingredients_ar ?? p.ingredients_en) : (p.ingredients_en ?? p.ingredients_ar)
    return {
      _id: p._id,
      title: title ?? '',
      price: p.price ?? 0,
      currency: p.currency ?? 'ILS',
      businessSlug: p.siteSlug ?? '',
      businessName: p.siteName ?? '',
      description: desc ?? undefined,
      isPopular: p.isPopular ?? false,
      ingredients: ingredients && ingredients.length > 0 ? ingredients : undefined,
    }
  })

  const lines: string[] = []
  const hoursList = await getBusinessHoursForCity(city, country)
  if (hoursList.length > 0) {
    lines.push('All businesses with opening hours (use this when user asks when a business opens/closes):')
    hoursList.slice(0, 30).forEach((h) => {
      const status = h.isOpenNow ? 'OPEN now' : 'CLOSED'
      lines.push(`- ${h.name} (slug: ${h.slug}): ${status}. Today: ${h.todayHours}`)
    })
  }
  if (businesses.length > 0 && terms.length > 0) {
    lines.push('\nBusinesses matching your search:')
    businesses.forEach((b) => lines.push(`- ${b.name} (slug: ${b.slug})`))
  }
  if (productContexts.length > 0) {
    lines.push('\nProducts available:')
    productContexts.forEach((p) => {
      const priceLine = p.price > 0 ? ` ${p.price} ${p.currency}` : ''
      const popularTag = p.isPopular ? ' [POPULAR]' : ''
      const ing = p.ingredients?.length ? ` | ingredients: ${p.ingredients.join(', ')}` : ''
      lines.push(`- ${p.title} @ ${p.businessName} (slug: ${p.businessSlug}, id: ${p._id})${priceLine}${popularTag}${ing}`)
    })
  }

  return {
    businesses,
    products: productContexts,
    contextText: lines.length > 0 ? lines.join('\n') : 'No matching businesses or products found in this city.',
  }
}
