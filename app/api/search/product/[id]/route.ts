/**
 * GET /api/search/product/[id]
 * Fetches a single product by ID for Add to Cart from AI search.
 * Returns Product shape + minimal tenant for CartContext.
 */
import { NextRequest } from 'next/server'
import { client } from '@/sanity/lib/client'

type ImageSource = { asset?: { _ref: string } } | null | undefined

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return Response.json({ error: 'Product ID required' }, { status: 400 })
    }

    const row = await client.fetch<{
      _id: string
      title_en?: string | null
      title_ar?: string | null
      description_en?: string | null
      description_ar?: string | null
      ingredients_en?: string[] | null
      ingredients_ar?: string[] | null
      price?: number
      saleUnit?: string
      hidePrice?: boolean
      specialPrice?: number
      specialPriceExpires?: string | null
      currency?: string
      image?: ImageSource
      additionalImages?: ImageSource[]
      categoryRef?: string
      sortOrder?: number
      isPopular?: boolean
      isAvailable?: boolean
      dietaryTags?: string[]
      addOns?: Array<{ name_en?: string; name_ar?: string; price?: number }>
      variants?: Array<{
        name_en?: string
        name_ar?: string
        required?: boolean
        options?: Array<{
          label_en?: string
          label_ar?: string
          priceModifier?: number
          specialPriceModifier?: number
          specialPriceModifierExpires?: string | null
        }>
      }>
      siteRef?: string
      siteName?: string
      siteSlug?: string
    } | null>(
      `*[_type == "product" && _id == $id][0] {
        _id,
        title_en,
        title_ar,
        description_en,
        description_ar,
        ingredients_en,
        ingredients_ar,
        price,
        saleUnit,
        hidePrice,
        specialPrice,
        specialPriceExpires,
        currency,
        image,
        additionalImages,
        "categoryRef": category._ref,
        sortOrder,
        isPopular,
        isAvailable,
        dietaryTags,
        addOns,
        variants,
        "siteRef": site._ref,
        "siteName": site->name,
        "siteSlug": site->slug.current
      }`,
      { id }
    )

    if (!row) {
      return Response.json({ error: 'Product not found' }, { status: 404 })
    }

    const product = {
      _id: row._id,
      title_en: row.title_en ?? '',
      title_ar: row.title_ar ?? '',
      description_en: row.description_en ?? undefined,
      description_ar: row.description_ar ?? undefined,
      ingredients_en: row.ingredients_en ?? undefined,
      ingredients_ar: row.ingredients_ar ?? undefined,
      price: row.price ?? 0,
      saleUnit: row.saleUnit ?? undefined,
      hidePrice: row.hidePrice ?? undefined,
      specialPrice: row.specialPrice ?? undefined,
      specialPriceExpires: row.specialPriceExpires ?? undefined,
      currency: row.currency ?? 'ILS',
      image: row.image?.asset?._ref
        ? { asset: { _ref: row.image.asset._ref } }
        : undefined,
      additionalImages: row.additionalImages?.filter((i) => i?.asset?._ref).map((i) => ({ asset: { _ref: i!.asset!._ref } })),
      category: { _ref: row.categoryRef ?? '' },
      sortOrder: row.sortOrder,
      isPopular: row.isPopular,
      isAvailable: row.isAvailable,
      dietaryTags: row.dietaryTags,
      addOns: row.addOns?.map((a) => ({
        name_en: a.name_en ?? '',
        name_ar: a.name_ar ?? '',
        price: a.price ?? 0,
      })),
      variants: row.variants?.map((v) => ({
        name_en: v.name_en ?? '',
        name_ar: v.name_ar ?? '',
        required: v.required,
        options: v.options?.map((o) => ({
          label_en: o.label_en ?? '',
          label_ar: o.label_ar ?? '',
          priceModifier: o.priceModifier ?? 0,
          specialPriceModifier: o.specialPriceModifier,
          specialPriceModifierExpires: o.specialPriceModifierExpires,
        })),
      })),
    }

    const tenant = {
      slug: row.siteSlug ?? '',
      name: row.siteName ?? '',
    }

    return Response.json({ product, tenant })
  } catch (e) {
    console.error('[search/product]', e)
    return Response.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}
