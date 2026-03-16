import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { getTenantIdBySlug } from '@/lib/tenant'
import { urlFor } from '@/sanity/lib/image'

/**
 * GET: List products for the order's business (for customer to add items when editing order).
 * Auth: tracking token in URL. Query: q (search), offset (default 0), limit (default 50).
 */
export async function GET(
  req: NextRequest,
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
  if (!order || order.site?._ref !== tenantId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.orderType !== 'delivery') {
    return NextResponse.json({ error: 'Only delivery orders can add products' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const rawQuery = (searchParams.get('q') || '').trim()
  const query = rawQuery.replace(/\s+/g, ' ').trim()
  const queryPattern = query ? `*${query}*` : ''
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))

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
    }>
  >(
    `*[
      _type == "product" &&
      site._ref == $siteId &&
      (isAvailable != false) &&
      (
        !defined($queryPattern) ||
        title_en match $queryPattern ||
        title_ar match $queryPattern
      )
    ] | order(title_en asc)[$offset...$end]{
      _id,
      title_en,
      title_ar,
      image,
      tempImageUrl,
      price,
      specialPrice,
      specialPriceExpires,
      currency
    }`,
    {
      siteId: tenantId,
      queryPattern: queryPattern || undefined,
      offset,
      end: offset + limit,
    }
  )

  const now = Date.now()
  const normalized = (products || []).map((p) => {
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
    }
  })

  return NextResponse.json({
    products: normalized,
    meta: { query, offset, limit },
  })
}
