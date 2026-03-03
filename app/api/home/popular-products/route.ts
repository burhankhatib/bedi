import { NextRequest } from 'next/server'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'

/** Cache 60s per (city, category) to reduce Sanity API calls. */
export const revalidate = 60

type ImageSource = { asset?: { _ref: string } } | null | undefined

/**
 * GET /api/home/popular-products?city=Jerusalem&category=restaurant
 * Returns popular products (isPopular) from tenants in the city, with restaurant info.
 * Product image, name, restaurant logo, name, slug. Limit 12 items.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const city = searchParams.get('city') ?? ''
  const category = searchParams.get('category') ?? ''

  const products = await client.fetch<
    Array<{
      _id: string
      title_en?: string
      title_ar?: string
      image?: ImageSource
      siteRef?: string
      siteName?: string
      siteSlug?: string
      siteBusinessLogo?: ImageSource
      restaurantLogo?: ImageSource
    }>
  >(
    `*[_type == "product" && defined(site) && (site._ref in *[_type == "tenant" && (city == $city || lower(city) == lower($city)) && !deactivated && ((subscriptionExpiresAt != null && subscriptionExpiresAt > now()) || (subscriptionExpiresAt == null && (!defined(createdAt) || dateTime(createdAt) + 2592000 > now()))) ${
      category ? '&& businessType == $category' : ''
    }]._id) && isPopular == true && ((isAvailable == true || isAvailable == null) || (isAvailable == false && availableAgainAt != null && now() > availableAgainAt))] | order(site->name asc) [0...12] {
      _id,
      title_en,
      title_ar,
      image,
      "siteRef": site._ref,
      "siteName": site->name,
      "siteSlug": site->slug.current,
      "siteBusinessLogo": site->businessLogo,
      "restaurantLogo": *[_type == "restaurantInfo" && site._ref == ^.site._ref][0].logo
    }`,
    { city, ...(category ? { category } : {}) }
  )

  const result = (products ?? []).map((p) => {
    const imageUrl = p.image?.asset?._ref ? urlFor(p.image).width(600).height(400).url() : null
    const logoSource = p.siteBusinessLogo?.asset?._ref ? p.siteBusinessLogo : p.restaurantLogo?.asset?._ref ? p.restaurantLogo : null
    const logoUrl = logoSource ? urlFor(logoSource).width(120).height(120).url() : null
    return {
      _id: p._id,
      title_en: p.title_en ?? '',
      title_ar: p.title_ar ?? '',
      imageUrl,
      restaurant: {
        _id: p.siteRef ?? '',
        name: p.siteName ?? '',
        slug: p.siteSlug ?? '',
        logoUrl,
      },
    }
  })

  return Response.json(result)
}
