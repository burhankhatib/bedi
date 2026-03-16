import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { getTenantIdBySlug } from '@/lib/tenant'
import { urlFor } from '@/sanity/lib/image'
import { getVariantOptionModifier } from '@/lib/cart-price'

type VariantOption = {
  label_en?: string
  label_ar?: string
  priceModifier?: number
  specialPriceModifier?: number
  specialPriceModifierExpires?: string
}

type VariantGroup = {
  name_en?: string
  name_ar?: string
  required?: boolean
  options?: VariantOption[]
}

type ProductRow = {
  _id: string
  productId: string
  title_en: string
  title_ar: string
  price: number
  currency: string
  imageUrl: string
  selectedVariants?: number[]
}

type CategorySection = {
  _id: string
  title_en: string
  title_ar: string
  products: ProductRow[]
}

/**
 * GET: Full menu for order's business (categories + products with variants expanded as separate rows).
 * For customer edit order — browse without search.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  const { slug, token: trackingToken } = await params
  if (!trackingToken?.trim()) return NextResponse.json({ error: 'Invalid link' }, { status: 400 })

  const tenantId = await getTenantIdBySlug(slug)
  if (!tenantId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const order = await client.fetch<{ _id: string; site?: { _ref?: string }; orderType?: string } | null>(
    `*[_type == "order" && site._ref == $tenantId && trackingToken == $trackingToken][0]{ _id, "site": site, orderType }`,
    { tenantId, trackingToken }
  )
  if (!order || order.site?._ref !== tenantId) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.orderType !== 'delivery') return NextResponse.json({ error: 'Only delivery orders' }, { status: 400 })

  const categories = await client.fetch<
    Array<{
      _id: string
      title_en?: string
      title_ar?: string
      products: Array<{
        _id: string
        title_en?: string
        title_ar?: string
        image?: unknown
        tempImageUrl?: string
        price?: number
        specialPrice?: number
        specialPriceExpires?: string
        currency?: string
        variants?: VariantGroup[]
      }>
    }>
  >(
    `*[_type == "category" && site._ref == $siteId] | order(sortOrder asc) {
      _id,
      title_en,
      title_ar,
      "products": *[_type == "product" && references(^._id) && (site._ref == $siteId || !defined(site)) && (isAvailable != false)] | order(sortOrder asc) {
        _id,
        title_en,
        title_ar,
        image,
        tempImageUrl,
        price,
        specialPrice,
        specialPriceExpires,
        currency,
        variants
      }
    }`,
    { siteId: tenantId }
  )

  const now = Date.now()
  const sections: CategorySection[] = []

  for (const cat of categories || []) {
    const productRows: ProductRow[] = []
    for (const p of cat.products || []) {
      const baseSpecial = typeof p.specialPrice === 'number' && (!p.specialPriceExpires || new Date(p.specialPriceExpires).getTime() > now)
      const basePrice = baseSpecial ? (p.specialPrice ?? 0) : (p.price ?? 0)
      let imageUrl = ''
      if (p.tempImageUrl) imageUrl = p.tempImageUrl
      else if (p.image) {
        try {
          imageUrl = urlFor(p.image).width(200).height(200).fit('crop').url()
        } catch {
          imageUrl = ''
        }
      }

      const groups = (p.variants ?? []).filter((g) => g.required === true)
      const optionalGroups = (p.variants ?? []).filter((g) => g.required !== true)

      if (groups.length === 0) {
        productRows.push({
          _id: p._id,
          productId: p._id,
          title_en: p.title_en || 'Item',
          title_ar: p.title_ar || p.title_en || 'صنف',
          price: basePrice,
          currency: p.currency || 'ILS',
          imageUrl,
        })
        continue
      }

      type Combo = number[]
      let combos: Combo[] = [[]]
      for (const group of groups) {
        const next: Combo[] = []
        const opts = group.options ?? []
        for (const c of combos) {
          for (let i = 0; i < opts.length; i++) {
            next.push([...c, i])
          }
        }
        if (next.length > 0) combos = next
      }

      const optionalIndices = optionalGroups.map(() => undefined)
      for (const combo of combos) {
        let variantPrice = 0
        const labels: string[] = []
        groups.forEach((group, gi) => {
          const oi = combo[gi]
          const opt = group.options?.[oi]
          if (opt) {
            variantPrice += getVariantOptionModifier(opt)
            labels.push(opt.label_en || opt.label_ar || '')
          }
        })
        const labelSuffix = labels.filter(Boolean).join(' – ')
        const titleEn = p.title_en ? (labelSuffix ? `${p.title_en} – ${labelSuffix}` : p.title_en) : 'Item'
        const titleAr = p.title_ar ? (labelSuffix ? `${p.title_ar} – ${labelSuffix}` : p.title_ar) : 'صنف'
        const variantsKey = combo.length > 0 ? `v${combo.join('-')}` : ''
        const rowId = variantsKey ? `${p._id}-${variantsKey}` : p._id

        productRows.push({
          _id: rowId,
          productId: p._id,
          title_en: titleEn,
          title_ar: titleAr,
          price: basePrice + variantPrice,
          currency: p.currency || 'ILS',
          imageUrl,
          selectedVariants: groups.length > 0 ? combo : undefined,
        })
      }
    }
    if (productRows.length > 0) {
      sections.push({
        _id: cat._id,
        title_en: cat.title_en || 'Category',
        title_ar: cat.title_ar || cat.title_en || 'فئة',
        products: productRows,
      })
    }
  }

  return NextResponse.json({ categories: sections })
}
