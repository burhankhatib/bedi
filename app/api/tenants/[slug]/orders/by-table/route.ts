import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { getTenantIdBySlug } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

const noCacheClient = client.withConfig({ useCdn: false })

/**
 * GET: Return active dine-in order for a table (for "Request to pay" from table QR).
 * No auth required — customer has table number from QR.
 * Returns trackingToken so client can call track/[token]/request for request_check.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const tenantId = await getTenantIdBySlug(slug)
  if (!tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const table = req.nextUrl.searchParams.get('table')
  const tableNumber = typeof table === 'string' ? table.trim() : null
  if (!tableNumber) {
    return NextResponse.json({ error: 'table query required' }, { status: 400 })
  }

  const order = await noCacheClient.fetch<{
    _id: string
    trackingToken?: string
    status?: string
  } | null>(
    `*[_type == "order" && site._ref == $tenantId && orderType == "dine-in" && tableNumber == $tableNumber && status != "completed" && status != "cancelled" && defined(trackingToken)][0]{ _id, trackingToken, status }`,
    { tenantId, tableNumber }
  )

  if (!order?.trackingToken) {
    return NextResponse.json({ order: null, trackingToken: null })
  }

  return NextResponse.json({
    order: { _id: order._id, status: order.status },
    trackingToken: order.trackingToken,
  })
}
