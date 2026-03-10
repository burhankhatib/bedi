import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getTenantIdBySlug } from '@/lib/tenant'
import { pusherServer } from '@/lib/pusher'

export const dynamic = 'force-dynamic'

const freshClient = client.withConfig({ useCdn: false })
const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** PATCH: Update tip for order (customer tracking page). */
export async function PATCH(
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
    tipSentToDriver?: boolean
  } | null>(
    `*[_type == "order" && site._ref == $tenantId && trackingToken == $trackingToken][0]{ _id, "site": site, tipSentToDriver }`,
    { tenantId, trackingToken }
  )

  if (!order || order.site?._ref !== tenantId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  let body: {
    tipPercent?: number
    tipAmount?: number
    tipConfirmedAfterCountdown?: boolean
    tipIncludedInTotal?: boolean
    removeTipReason?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const tipPercent = typeof body.tipPercent === 'number' ? Math.max(0, Math.min(100, body.tipPercent)) : undefined
  const tipAmount = typeof body.tipAmount === 'number' ? Math.max(0, body.tipAmount) : undefined

  if (!token) {
    return NextResponse.json({ error: 'Server config' }, { status: 500 })
  }

  const patch: Record<string, unknown> = {}
  if (tipPercent !== undefined) patch.tipPercent = tipPercent
  if (tipAmount !== undefined) patch.tipAmount = tipAmount
  if (typeof body.tipConfirmedAfterCountdown === 'boolean') {
    patch.tipConfirmedAfterCountdown = body.tipConfirmedAfterCountdown
  }
  if (typeof body.tipIncludedInTotal === 'boolean') {
    patch.tipIncludedInTotal = body.tipIncludedInTotal
  }

  const tipRemoved = (tipPercent === 0 || tipAmount === 0) && order.tipSentToDriver
  if (tipRemoved) {
    patch.tipSentToDriver = false
    patch.tipIncludedInTotal = false
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: true })
  }

  await writeClient.patch(order._id).set(patch).commit()

  if (body.removeTipReason && typeof body.removeTipReason === 'string' && body.removeTipReason.trim()) {
    await writeClient.create({
      _type: 'report',
      reporter: 'customer',
      reported: 'driver',
      reason: 'customer_removed_tip_after_arrival',
      description: body.removeTipReason.trim(),
      order: { _type: 'reference', _ref: order._id },
      createdAt: new Date().toISOString(),
    })
  }

  if (order.tipSentToDriver || tipRemoved || body.tipIncludedInTotal !== undefined) {
    pusherServer
      .trigger(`order-${order._id}`, 'order-update', { type: 'tip-updated' })
      .catch(() => {})
    pusherServer
      .trigger('driver-global', 'order-update', { type: 'tip-updated', orderId: order._id })
      .catch(() => {})
  }

  return NextResponse.json({ success: true })
}
