import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { triggerPusherEvent } from '@/lib/pusher'
import { isDriverAtBusiness } from '@/lib/driver-items-lock'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'
import { sendCustomerOrderStatusPush } from '@/lib/customer-order-push'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { getActiveSubscriptionsForUser } from '@/lib/user-push-subscriptions'

/**
 * POST /api/driver/location
 * Save driver GPS coordinates to Sanity and broadcast via Pusher so the
 * customer tracking page receives real-time position updates without polling.
 * When driver enters 50m of business (driver_on_the_way): unlock items, send FCM.
 * Body: { lat: number, lng: number }
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  const lat = typeof body.lat === 'number' ? body.lat : undefined
  const lng = typeof body.lng === 'number' ? body.lng : undefined

  if (lat === undefined || lng === undefined || !isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng (numbers) are required' }, { status: 400 })
  }

  const writeClient = client.withConfig({ token, useCdn: false })

  const driver = await writeClient.fetch<{
    _id: string
    clerkUserId?: string
    fcmToken?: string
    pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
    activeOrderIds: string[]
    pickupOrderIds: Array<{ _id: string; siteRef: string }>
  } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{
      _id,
      clerkUserId,
      fcmToken,
      "pushSubscription": pushSubscription,
      "activeOrderIds": *[
        _type == "order" &&
        orderType == "delivery" &&
        assignedDriver._ref == ^._id &&
        status in ["driver_on_the_way", "out-for-delivery"]
      ]._id,
      "pickupOrderIds": *[
        _type == "order" &&
        orderType == "delivery" &&
        assignedDriver._ref == ^._id &&
        status == "driver_on_the_way" &&
        !defined(driverArrivedAtBusinessAt)
      ]{ _id, "siteRef": site._ref }
    }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  await writeClient
    .patch(driver._id)
    .set({
      lastKnownLat: lat,
      lastKnownLng: lng,
      lastLocationAt: new Date().toISOString(),
    })
    .commit()

  if (driver.activeOrderIds.length > 0) {
    await Promise.all(
      driver.activeOrderIds.map((orderId) =>
        triggerPusherEvent(`private-driver-location-${orderId}`, 'location-update', { lat, lng })
      )
    )
  }

  for (const { _id: orderId, siteRef } of driver.pickupOrderIds ?? []) {
    const tenant = await writeClient.fetch<{ locationLat?: number; locationLng?: number } | null>(
      `*[_type == "tenant" && _id == $id][0]{ locationLat, locationLng }`,
      { id: siteRef }
    )
    const hasLocation = tenant?.locationLat != null && tenant?.locationLng != null
    if (!hasLocation) continue
    if (!isDriverAtBusiness(lat, lng, tenant?.locationLat, tenant?.locationLng)) continue

    const restaurant = await writeClient.fetch<{ name_en?: string; name_ar?: string } | null>(
      `*[_type == "restaurantInfo" && site._ref == $id][0]{ name_en, name_ar }`,
      { id: siteRef }
    )
    const businessName = restaurant?.name_ar || restaurant?.name_en || 'المتجر'

    await writeClient
      .patch(orderId)
      .set({ driverArrivedAtBusinessAt: new Date().toISOString() })
      .commit()

    triggerPusherEvent('driver-global', 'order-update', {
      type: 'items-unlocked',
      orderId,
      businessName,
    }).catch(() => {})

    const driverPushPayload = {
      title: 'تم فتح العناصر',
      body: `يمكنك الآن عرض عناصر الطلب لأنك وصلت إلى ${businessName}.`,
      url: '/driver/orders',
      dir: 'rtl' as const,
    }
    let driverPushSent = false
    if (driver.clerkUserId) {
      const subs = await getActiveSubscriptionsForUser({ clerkUserId: driver.clerkUserId, roleContext: 'driver' })
      for (const sub of subs) {
        for (const dev of sub?.devices ?? []) {
          if (dev?.fcmToken && isFCMConfigured()) {
            const payloadWithClient = dev.pushClient ? { ...driverPushPayload, pushClient: dev.pushClient } : driverPushPayload
            if (await sendFCMToToken(dev.fcmToken, payloadWithClient)) {
              driverPushSent = true
              break
            }
          }
          if (
            dev?.webPush?.endpoint &&
            dev.webPush?.p256dh &&
            dev.webPush?.auth &&
            isPushConfigured() &&
            (await sendPushNotification(
              { endpoint: dev.webPush.endpoint, keys: { p256dh: dev.webPush.p256dh, auth: dev.webPush.auth } },
              driverPushPayload
            ))
          ) {
            driverPushSent = true
            break
          }
        }
        if (driverPushSent) break
      }
    }
    if (!driverPushSent && driver.fcmToken && isFCMConfigured()) {
      driverPushSent = await sendFCMToToken(driver.fcmToken, driverPushPayload)
    }
    if (
      !driverPushSent &&
      driver.pushSubscription?.endpoint &&
      driver.pushSubscription?.p256dh &&
      driver.pushSubscription?.auth &&
      isPushConfigured()
    ) {
      await sendPushNotification(
        { endpoint: driver.pushSubscription.endpoint, keys: { p256dh: driver.pushSubscription.p256dh, auth: driver.pushSubscription.auth } },
        driverPushPayload
      )
    }

    sendCustomerOrderStatusPush({
      orderId,
      newStatus: 'driver_arrived_at_business',
      baseUrl: process.env.NEXT_PUBLIC_APP_URL,
    }).catch((e) => console.warn('[driver-location] customer FCM driver_arrived_at_business', e))
  }

  return NextResponse.json({ ok: true, lat, lng })
}
