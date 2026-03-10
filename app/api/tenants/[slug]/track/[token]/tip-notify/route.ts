import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getTenantIdBySlug } from '@/lib/tenant'
import { pusherServer } from '@/lib/pusher'

export const dynamic = 'force-dynamic'

const freshClient = client.withConfig({ useCdn: false })
const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** POST: Customer sends tip notification to the driver so they can see it during delivery. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  const { slug, token: trackingToken } = await params
  if (!trackingToken?.trim()) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 })
  }

  const tenantId = await getTenantIdBySlug(slug)
  if (!tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const order = await freshClient.fetch<{
    _id: string
    site?: { _ref?: string }
    status?: string
    tipPercent?: number
    tipAmount?: number
  } | null>(
    `*[_type == "order" && site._ref == $tenantId && trackingToken == $trackingToken][0]{
      _id, "site": site, status, tipPercent, tipAmount
    }`,
    { tenantId, trackingToken }
  )

  if (!order || order.site?._ref !== tenantId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (!token) {
    return NextResponse.json({ error: 'Server config' }, { status: 500 })
  }

  let body: { tipPercent?: number; tipAmount?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const tipPercent = typeof body.tipPercent === 'number' ? Math.max(0, Math.min(100, body.tipPercent)) : order.tipPercent ?? 0
  const tipAmount = typeof body.tipAmount === 'number' ? Math.max(0, body.tipAmount) : order.tipAmount ?? 0

  if (tipAmount <= 0) {
    return NextResponse.json({ error: 'No tip to send' }, { status: 400 })
  }

  await writeClient.patch(order._id).set({
    tipSentToDriver: true,
    tipSentToDriverAt: new Date().toISOString(),
    tipPercent,
    tipAmount,
  }).commit()

  pusherServer
    .trigger(`order-${order._id}`, 'order-update', { type: 'tip-sent-to-driver' })
    .catch(() => {})

  pusherServer
    .trigger('driver-global', 'order-update', { type: 'tip-sent-to-driver', orderId: order._id })
    .catch(() => {})

  return NextResponse.json({ success: true })
}
