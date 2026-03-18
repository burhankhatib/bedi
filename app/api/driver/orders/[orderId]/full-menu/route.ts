import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'
import { getVariantOptionModifier } from '@/lib/cart-price'
import { isDriverAtBusiness } from '@/lib/driver-items-lock'

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
 * GET: Full menu for the order's business (categories + products with variants expanded).
 * For driver add/replace items — browse without search.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId } = await params
  const driver = await client.fetch<{ _id: string; lastKnownLat?: number; lastKnownLng?: number } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id, lastKnownLat, lastKnownLng }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  const order = await client.fetch<{ assignedDriverRef?: string; siteRef?: string; status?: string; driverPickedUpAt?: string } | null>(
    `*[_type == "order" && _id == $orderId][0]{ "assignedDriverRef": assignedDriver._ref, "siteRef": site._ref, status, driverPickedUpAt }`,
    { orderId }
  )
  if (!order?.siteRef) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.assignedDriverRef !== driver._id) return NextResponse.json({ error: 'Order not assigned to you' }, { status: 403 })

  if (order.status !== 'out-for-delivery' && !order.driverPickedUpAt) {
    const tenant = await client.fetch<{ locationLat?: number; locationLng?: number } | null>(
      `*[_type == "tenant" && _id == $id][0]{ locationLat, locationLng }`,
      { id: order.siteRef }
    )
    const hasLocation = tenant?.locationLat != null && tenant?.locationLng != null
    if (hasLocation && !isDriverAtBusiness(driver.lastKnownLat, driver.lastKnownLng, tenant?.locationLat, tenant?.locationLng)) {
      const restaurant = await client.fetch<{ name_en?: string; name_ar?: string } | null>(
        `*[_type == "restaurantInfo" && site._ref == $id][0]{ name_en, name_ar }`,
        { id: order.siteRef }
      )
      const businessName = restaurant?.name_ar || restaurant?.name_en || 'المتجر'
      return NextResponse.json(
        { error: `يجب أن تكون في ${businessName} لعرض القائمة.`, errorEn: `You must be at ${businessName} to view the menu.` },
        { status: 403 }
      )
    }
  }

  const siteId = order.siteRef

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
    { siteId }
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
