import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { getTenantIdBySlug } from '@/lib/tenant'
import { normalizePhoneForOrderLookup, phonesMatchForOrderLookup } from '@/lib/driver-utils'

export const dynamic = 'force-dynamic'

/** GET: List orders for customer tracking by phone. Returns orderNumber, createdAt, trackingToken for each. Used by "Track your order" form. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const phoneParam = req.nextUrl.searchParams.get('phone')
  if (!phoneParam?.trim()) {
    return NextResponse.json({ error: 'Phone required' }, { status: 400 })
  }

  const tenantId = await getTenantIdBySlug(slug)
  if (!tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!normalizePhoneForOrderLookup(phoneParam)) {
    return NextResponse.json({ orders: [] })
  }

  const orders = await client.fetch<
    Array<{ _id: string; customerPhone?: string; orderNumber?: string; createdAt?: string; trackingToken?: string }>
  >(
    `*[_type == "order" && site._ref == $tenantId && defined(trackingToken)] | order(createdAt desc) {
      _id,
      customerPhone,
      orderNumber,
      createdAt,
      trackingToken
    }`,
    { tenantId }
  )

  const matching = (orders ?? [])
    .filter((o) => phonesMatchForOrderLookup(phoneParam, o.customerPhone ?? ''))
    .map((o) => ({
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      trackingToken: o.trackingToken,
    }))
    .filter((o) => o.trackingToken)

  return NextResponse.json({ orders: matching })
}
