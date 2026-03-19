import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'
import { sendCustomerOrderStatusPush } from '@/lib/customer-order-push'
import { sendTenantOrderUpdatePush } from '@/lib/tenant-order-push'
import { getManualAssignmentPushAr } from '@/lib/driver-push-messages'
import { cancelOrderJobs } from '@/lib/delivery-job-scheduler'

async function checkOrderOwnership(slug: string, orderId: string) {
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return { ok: false as const, status: auth.status }
  const doc = await client.fetch<{ _id: string; site?: { _ref: string } } | null>(
    `*[_type == "order" && _id == $orderId][0]{ _id, site }`,
    { orderId }
  )
  if (!doc || doc.site?._ref !== auth.tenantId) return { ok: false as const, status: 403 }
  return { ok: true as const }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json()
  const { orderId, driverId } = body
  if (!orderId || !driverId) {
    return NextResponse.json({ error: 'orderId and driverId required' }, { status: 400 })
  }

  const check = await checkOrderOwnership(slug, orderId)
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status })

  const writeClient = client.withConfig({ token, useCdn: false })
  const orderBefore = await writeClient.fetch<{
    orderNumber?: string
    status?: string
    totalAmount?: number
    deliveryFee?: number
    shopperFee?: number
    currency?: string
  } | null>(
    `*[_type == "order" && _id == $orderId][0]{ orderNumber, status, totalAmount, deliveryFee, shopperFee, currency }`,
    { orderId }
  )
  if (!orderBefore) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (orderBefore.status === 'cancelled' || orderBefore.status === 'refunded') {
    return NextResponse.json({ error: 'Cannot assign driver to a cancelled or refunded order' }, { status: 400 })
  }
  const orderNumber = orderBefore.orderNumber ?? orderId.slice(-6)

  await writeClient
    .patch(orderId)
    .set({
      assignedDriver: { _type: 'reference', _ref: driverId },
      status: 'waiting_for_delivery',
      manualAssignmentAt: new Date().toISOString(),
    })
    .unset(['deliveryRequestedAt', 'declinedByDriverIds', 'driverAcceptedAt'])
    .commit()
  await cancelOrderJobs(orderId)

  // Notify the assigned driver via FCM or Web Push — friendly Arabic, ask them to open app to confirm or decline
  const pushReady = isFCMConfigured() || isPushConfigured()
  if (pushReady) {
    try {
      type DriverRow = {
        fcmToken?: string
        nickname?: string
        pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
      }
      const driver = await writeClient.fetch<DriverRow | null>(
        `*[_type == "driver" && _id == $driverId][0]{ fcmToken, nickname, "pushSubscription": pushSubscription }`,
        { driverId }
      )
      const { title, body } = getManualAssignmentPushAr(driver?.nickname, orderNumber)
      const payload = {
        title,
        body,
        url: '/driver/orders',
        dir: 'rtl' as const,
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
      console.error('[assign-driver] Push to driver failed:', e)
    }
  }

  sendCustomerOrderStatusPush({
    orderId,
    newStatus: 'waiting_for_delivery',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  }).catch((e) => console.warn('[customer-order-push]', e))

  sendTenantOrderUpdatePush({
    orderId,
    status: 'waiting_for_delivery',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  }).catch((e) => console.warn('[tenant-order-push]', e))

  return NextResponse.json({ message: 'Driver assigned successfully' }, { status: 200 })
}
