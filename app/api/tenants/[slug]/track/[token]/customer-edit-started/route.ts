import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { getTenantIdBySlug } from '@/lib/tenant'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'
import { sendPushNotification, isPushConfigured } from '@/lib/push'

const freshClient = client.withConfig({ useCdn: false })

/**
 * POST: Customer clicked "Edit Order". Send FCM to the assigned driver so they know
 * the customer is updating the order list and should check the app to approve when the customer finishes.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  const { slug, token: trackingToken } = await params
  if (!trackingToken?.trim()) return NextResponse.json({ error: 'Invalid link' }, { status: 400 })

  const tenantId = await getTenantIdBySlug(slug)
  if (!tenantId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const order = await freshClient.fetch<{
    _id: string
    site?: { _ref?: string }
    assignedDriver?: { _ref?: string }
    orderNumber?: string
    orderType?: string
  } | null>(
    `*[_type == "order" && site._ref == $tenantId && trackingToken == $trackingToken][0]{
      _id,
      "site": site,
      assignedDriver,
      orderNumber,
      orderType
    }`,
    { tenantId, trackingToken }
  )
  if (!order || order.site?._ref !== tenantId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.orderType !== 'delivery') {
    return NextResponse.json({ error: 'Only delivery orders can be edited' }, { status: 400 })
  }

  const driverRef = order.assignedDriver?._ref
  if (!driverRef) {
    return NextResponse.json({ success: true, message: 'No driver assigned' })
  }

  const pushReady = isFCMConfigured() || isPushConfigured()
  if (!pushReady) {
    return NextResponse.json({ success: true, message: 'Push not configured' })
  }

  try {
    const driver = await freshClient.fetch<{
      fcmToken?: string
      pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
    } | null>(
      `*[_type == "driver" && _id == $driverId][0]{ fcmToken, "pushSubscription": pushSubscription }`,
      { driverId: driverRef }
    )
    const orderNum = order.orderNumber ?? order._id.slice(-6)
    const payload = {
      title: '\u200Fالعميل يحدّث قائمة الطلب',
      body: `العميل يحدّث قائمة الطلب. راجع التطبيق للموافقة عند الانتهاء. طلب #${orderNum}`,
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
          { title: payload.title, body: payload.body, url: payload.url }
        )
      }
    }
  } catch (e) {
    console.error('[customer-edit-started] Driver push failed:', e)
  }

  return NextResponse.json({ success: true })
}
