import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'

/**
 * POST /api/orders/[id]/location
 * Save customer delivery GPS coordinates on the order.
 * Authenticated by possession of the order's trackingToken.
 * Body: { trackingToken: string, lat: number, lng: number }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  const trackingToken = typeof body.trackingToken === 'string' ? body.trackingToken.trim() : ''
  const lat = typeof body.lat === 'number' ? body.lat : undefined
  const lng = typeof body.lng === 'number' ? body.lng : undefined

  if (!trackingToken) return NextResponse.json({ error: 'trackingToken required' }, { status: 400 })
  if (lat === undefined || lng === undefined || !isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng (numbers) are required' }, { status: 400 })
  }

  // Verify the token matches the order (unauthenticated customer access via secret token)
  const order = await client.fetch<{ _id: string; orderType?: string } | null>(
    `*[_type == "order" && _id == $orderId && trackingToken == $trackingToken][0]{ _id, orderType }`,
    { orderId, trackingToken }
  )
  if (!order) return NextResponse.json({ error: 'Order not found or invalid token' }, { status: 404 })
  if (order.orderType !== 'delivery') {
    return NextResponse.json({ error: 'Location sharing is only available for delivery orders' }, { status: 400 })
  }

  const writeClient = client.withConfig({ token, useCdn: false })
  await writeClient.patch(orderId).set({ deliveryLat: lat, deliveryLng: lng }).commit()

  return NextResponse.json({ ok: true, lat, lng })
}
