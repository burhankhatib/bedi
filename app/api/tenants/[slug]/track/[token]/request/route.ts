import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getTenantIdBySlug } from '@/lib/tenant'
import { sendTenantAndStaffPush } from '@/lib/tenant-and-staff-push'
import { isFCMConfigured } from '@/lib/fcm'
import { isPushConfigured } from '@/lib/push'

import { pusherServer } from '@/lib/pusher'

export const dynamic = 'force-dynamic'

const freshClient = client.withConfig({ useCdn: false })
const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** POST: Dine-in customer requests "Call waiter" or "Ask for check". Triggers ring on restaurant dashboard. */
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
    orderType?: string
    status?: string
    tableNumber?: string
    site?: { _ref?: string }
  } | null>(
    `*[_type == "order" && site._ref == $tenantId && trackingToken == $trackingToken][0]{ _id, orderType, status, tableNumber, "site": site }`,
    { tenantId, trackingToken }
  )

  if (!order || order.site?._ref !== tenantId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.orderType !== 'dine-in') {
    return NextResponse.json({ error: 'Only dine-in orders can request waiter or check' }, { status: 400 })
  }
  if (order.status === 'completed') {
    return NextResponse.json({ error: 'Order is already completed' }, { status: 400 })
  }

  let body: { type?: string; paymentMethod?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const type = body.type === 'call_waiter' ? 'call_waiter' : body.type === 'request_check' ? 'request_check' : null
  if (!type) {
    return NextResponse.json({ error: 'type must be call_waiter or request_check' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const paymentMethod = type === 'request_check'
    ? (body.paymentMethod === 'cash' ? 'cash' : 'card')
    : undefined

  if (!token) {
    return NextResponse.json({ error: 'Server config' }, { status: 500 })
  }

  let p = writeClient
    .patch(order._id)
    .set({ customerRequestType: type, customerRequestedAt: now })
    .unset(['customerRequestAcknowledgedAt'])
  if (type === 'request_check') {
    p = p.set({ customerRequestPaymentMethod: paymentMethod })
  } else {
    p = p.unset(['customerRequestPaymentMethod'])
  }
  await p.commit()
  
  await pusherServer.trigger(`tenant-${tenantId}`, 'order-update', { orderId: order._id }).catch(() => {})

  // Send high-priority FCM/push to tenant (owner) and all staff
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  if (order.site?._ref && (isFCMConfigured() || isPushConfigured())) {
    const tenant = await freshClient.fetch<{ slug?: string } | null>(
      `*[_type == "tenant" && _id == $id][0]{ "slug": slug.current }`,
      { id: order.site._ref }
    )
    const tableLabel = order.tableNumber ? `Table ${order.tableNumber}` : 'A table'
    const isHelp = type === 'call_waiter'
    const title = isHelp ? `${tableLabel} needs help` : `${tableLabel} wants to pay`
    const body = isHelp
      ? 'Customer requested assistance — tap to open order.'
      : `Customer would like to pay with ${paymentMethod === 'cash' ? 'cash' : 'card'}.`
    const path = tenant?.slug ? `/t/${tenant.slug}/orders?open=${order._id}` : '/orders'
    const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path
    await sendTenantAndStaffPush(order.site._ref, { title, body, url })
  }

  return NextResponse.json({ success: true })
}
