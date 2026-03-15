import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId } = await params
  const driver = await client.fetch<{ _id: string } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  const order = await client.fetch<{ assignedDriverRef?: string; siteRef?: string } | null>(
    `*[_type == "order" && _id == $orderId][0]{ "assignedDriverRef": assignedDriver._ref, "siteRef": site._ref }`,
    { orderId }
  )
  if (!order?.siteRef) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.assignedDriverRef !== driver._id) return NextResponse.json({ error: 'Order is not assigned to you' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const sourceProductId = (searchParams.get('sourceProductId') || '').trim()
  const rawQuery = (searchParams.get('q') || '').trim()
  const query = rawQuery.replace(/\s+/g, ' ').trim()
  const queryPattern = query ? `*${query}*` : ''

  if (!sourceProductId) {
    return NextResponse.json({ products: [] })
  }

  const sourceProduct = await client.fetch<{
    categoryId?: string
    price?: number
    specialPrice?: number
    specialPriceExpires?: string
  } | null>(
    `*[_type == "product" && _id == $productId && site._ref == $siteId][0]{
      "categoryId": category._ref,
      price,
      specialPrice,
      specialPriceExpires
    }`,
    { productId: sourceProductId, siteId: order.siteRef }
  )

  if (!sourceProduct?.categoryId) {
    return NextResponse.json({ products: [] })
  }

  const products = await client.fetch<
    Array<{
      _id: string
      title_en?: string
      title_ar?: string
      image?: unknown
      tempImageUrl?: string
      price?: number
      specialPrice?: number
      specialPriceExpires?: string
      currency?: string
      isAvailable?: boolean
      categoryId?: string
    }>
  >(
    `*[
      _type == "product" &&
      site._ref == $siteId &&
      (isAvailable != false) &&
      _id != $sourceProductId &&
      category._ref == $categoryId &&
      (
        !defined($queryPattern) ||
        title_en match $queryPattern ||
        title_ar match $queryPattern
      )
    ][0...120]{
      _id,
      title_en,
      title_ar,
      image,
      tempImageUrl,
      "categoryId": category._ref,
      price,
      specialPrice,
      specialPriceExpires,
      currency,
      isAvailable
    }`,
    {
      siteId: order.siteRef,
      sourceProductId,
      categoryId: sourceProduct.categoryId,
      queryPattern: queryPattern || undefined,
    }
  )

  const now = Date.now()
  const sourceSpecialActive =
    typeof sourceProduct.specialPrice === 'number' &&
    (!sourceProduct.specialPriceExpires || new Date(sourceProduct.specialPriceExpires).getTime() > now)
  const sourceEffectivePrice: number = sourceSpecialActive
    ? Number(sourceProduct.specialPrice ?? 0)
    : Number(sourceProduct.price ?? 0)

  const normalized: Array<{
    _id: string
    title_en: string
    title_ar: string
    price: number
    currency: string
    imageUrl: string
    categoryId: string
  }> = (products || []).map((p) => {
    const specialActive =
      typeof p.specialPrice === 'number' &&
      (!p.specialPriceExpires || new Date(p.specialPriceExpires).getTime() > now)
    const effectivePrice = specialActive ? p.specialPrice : (p.price ?? 0)
    let imageUrl = ''
    if (p.tempImageUrl) {
      imageUrl = p.tempImageUrl
    } else if (p.image) {
      try {
        imageUrl = urlFor(p.image).width(160).height(160).fit('crop').url()
      } catch {
        imageUrl = ''
      }
    }
    return {
      _id: p._id,
      title_en: p.title_en || 'Item',
      title_ar: p.title_ar || p.title_en || 'صنف',
      price: Number.isFinite(effectivePrice) ? Number(effectivePrice) : 0,
      currency: p.currency || 'ILS',
      imageUrl,
      categoryId: p.categoryId || '',
    }
  })
  normalized.sort((a, b) => {
    const aInPriority = a.price <= sourceEffectivePrice
    const bInPriority = b.price <= sourceEffectivePrice
    if (aInPriority !== bInPriority) return aInPriority ? -1 : 1
    if (aInPriority && bInPriority) {
      const aDelta = Math.abs(sourceEffectivePrice - a.price)
      const bDelta = Math.abs(sourceEffectivePrice - b.price)
      if (aDelta !== bDelta) return aDelta - bDelta
    }
    if (a.price !== b.price) return a.price - b.price
    return a.title_en.localeCompare(b.title_en)
  })

  return NextResponse.json({
    products: normalized,
    meta: {
      sourceProductId,
      sourceEffectivePrice,
      query,
    },
  })
}
