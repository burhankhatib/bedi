/**
 * GET /api/tenants/[slug]/search?q=...
 * Per-business search: products and categories for this tenant only.
 * Public endpoint — no auth required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'
import { getTenantBySlug } from '@/lib/tenant'
import { fuzzySearch, type SearchableItem } from '@/lib/search/fuzzy-suggest'
import { suggestCorrection } from '@/lib/search/fuzzy-suggest'

export const revalidate = 60

type ImageSource = { asset?: { _ref: string } } | null | undefined

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const qRaw = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 30, 50)
  const lang = (req.nextUrl.searchParams.get('lang') ?? 'en').toLowerCase() === 'ar' ? 'ar' : 'en'

  const tenant = await getTenantBySlug(slug)
  if (!tenant) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  type ProductRow = {
    _id: string
    title_en?: string | null
    title_ar?: string | null
    description_en?: string | null
    description_ar?: string | null
    image?: ImageSource
    price?: number
    currency?: string
    saleUnit?: string
    specialPrice?: number
    specialPriceExpires?: string | null
    categoryTitleEn?: string | null
    categoryTitleAr?: string | null
  }

  const products = await client.fetch<ProductRow[]>(
    `*[_type == "product" && site._ref == $siteId && ((isAvailable == true || isAvailable == null) || (isAvailable == false && availableAgainAt != null && now() > availableAgainAt))] | order(sortOrder asc) [0...100] {
      _id,
      title_en,
      title_ar,
      description_en,
      description_ar,
      image,
      price,
      currency,
      saleUnit,
      specialPrice,
      specialPriceExpires,
      "categoryTitleEn": category->title_en,
      "categoryTitleAr": category->title_ar
    }`,
    { siteId: tenant._id }
  )

  const rows = products ?? []

  if (!qRaw) {
    const productResult = rows.slice(0, limit).map((p) => {
      const hasSpecial = p.specialPrice && (!p.specialPriceExpires || new Date(p.specialPriceExpires) > new Date())
      const price = hasSpecial ? p.specialPrice! : p.price ?? 0
      return {
        _id: p._id,
        title_en: p.title_en ?? null,
        title_ar: p.title_ar ?? null,
        description_en: p.description_en ?? null,
        description_ar: p.description_ar ?? null,
        imageUrl: p.image?.asset?._ref ? urlFor(p.image).width(300).height(200).url() : null,
        price,
        currency: p.currency ?? 'ILS',
        saleUnit: p.saleUnit ?? 'piece',
        category: p.categoryTitleEn || p.categoryTitleAr ? { en: p.categoryTitleEn ?? null, ar: p.categoryTitleAr ?? null } : null,
      }
    })
    return NextResponse.json({ products: productResult, didYouMean: null })
  }

  const searchableItems: SearchableItem[] = rows.map((p) => ({
    id: p._id,
    text: [p.title_en, p.title_ar, p.categoryTitleEn, p.categoryTitleAr, p.description_en, p.description_ar]
      .filter(Boolean)
      .join(' '),
    textSecondary: [p.description_en, p.description_ar].filter(Boolean).join(' ') || undefined,
    textEn: (p.title_en ?? p.title_ar) || undefined,
    textAr: (p.title_ar ?? p.title_en) || undefined,
  }))

  const fuzzyMatched = fuzzySearch(qRaw, searchableItems, { threshold: 0.45, limit })

  const matchedIds = new Set(fuzzyMatched.map((i) => i.id))
  const productResult = rows
    .filter((p) => matchedIds.has(p._id))
    .slice(0, limit)
    .map((p) => {
      const hasSpecial = p.specialPrice && (!p.specialPriceExpires || new Date(p.specialPriceExpires) > new Date())
      const price = hasSpecial ? p.specialPrice! : p.price ?? 0
      return {
        _id: p._id,
        title_en: p.title_en ?? null,
        title_ar: p.title_ar ?? null,
        description_en: p.description_en ?? null,
        description_ar: p.description_ar ?? null,
        imageUrl: p.image?.asset?._ref ? urlFor(p.image).width(300).height(200).url() : null,
        price,
        currency: p.currency ?? 'ILS',
        saleUnit: p.saleUnit ?? 'piece',
        category: p.categoryTitleEn || p.categoryTitleAr ? { en: p.categoryTitleEn ?? null, ar: p.categoryTitleAr ?? null } : null,
      }
    })

  let didYouMean: string | null = null
  if (productResult.length === 0 && searchableItems.length > 0) {
    didYouMean = suggestCorrection(qRaw, searchableItems, { threshold: 0.5, limit: 3, preferLang: lang })
  }

  return NextResponse.json({ products: productResult, didYouMean })
}
