import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getTenantIdBySlug } from '@/lib/tenant'
import { pusherServer } from '@/lib/pusher'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'
import { sendPushNotification, isPushConfigured } from '@/lib/push'

const freshClient = client.withConfig({ useCdn: false })
const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  const { slug, token: trackingToken } = await params
  if (!trackingToken?.trim()) return NextResponse.json({ error: 'Invalid link' }, { status: 400 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const tenantId = await getTenantIdBySlug(slug)
  if (!tenantId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const order = await freshClient.fetch<{
    _id: string
    site?: { _ref?: string }
    assignedDriver?: { _ref?: string }
    orderNumber?: string
  } | null>(
    `*[_type == "order" && site._ref == $tenantId && trackingToken == $trackingToken][0]{
      _id,
      "site": site,
      assignedDriver,
      orderNumber
    }`,
    { tenantId, trackingToken }
  )
  if (!order || order.site?._ref !== tenantId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  let body: { action?: 'approve' | 'contact_request'; note?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const action = body.action
  if (!action || !['approve', 'contact_request'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve or contact_request' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const status = action === 'approve' ? 'approved' : 'contact_requested'
  const note = (body.note || '').trim()

  await writeClient.patch(order._id).set({
    customerItemChangeStatus: status,
    customerItemChangeResolvedAt: now,
    customerItemChangeResponseNote: note || null,
  }).commit()

  pusherServer
    .trigger(`order-${order._id}`, 'order-update', { type: 'customer-item-change-response', orderId: order._id, status })
    .catch(() => {})
  pusherServer
    .trigger('driver-global', 'order-update', { type: 'customer-item-change-response', orderId: order._id, status })
    .catch(() => {})

  const driverId = order.assignedDriver?._ref
  if (driverId) {
    try {
      const driver = await freshClient.fetch<{
        fcmToken?: string
        pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
      } | null>(
        `*[_type == "driver" && _id == $driverId][0]{ fcmToken, "pushSubscription": pushSubscription }`,
        { driverId }
      )
      const orderNum = order.orderNumber || order._id.slice(-6)
      const payload = {
        title: action === 'approve' ? 'Customer approved item changes' : 'Customer requested contact',
        body: action === 'approve'
          ? `Order #${orderNum}: customer accepted the updated items.`
          : `Order #${orderNum}: customer wants to discuss alternatives.`,
        url: '/driver/orders',
      }
      if (driver?.fcmToken && isFCMConfigured()) {
        await sendFCMToToken(driver.fcmToken, payload)
      } else {
        const sub = driver?.pushSubscription
        if (sub?.endpoint && sub?.p256dh && sub?.auth && isPushConfigured()) {
          await sendPushNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
        }
      }
    } catch (e) {
      console.error('[track-item-changes] driver push failed:', e)
    }
  }

  return NextResponse.json({ success: true, status })
}
