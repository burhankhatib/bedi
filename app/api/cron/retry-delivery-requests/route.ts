import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

const RETRY_INTERVAL_MS = 3 * 60 * 1000 // 3 minutes
const RTL_MARK = '\u200F'

type PendingOrder = {
  _id: string
  siteRef?: string
  totalAmount?: number
  deliveryFee?: number
  currency?: string
  deliveryAreaNameAr?: string
  deliveryAreaNameEn?: string
  declinedByDriverRefs?: string[]
  deliveryRequestedAt?: string
  lastDeliveryRequestPingAt?: string
}

type DriverRow = {
  _id: string
  fcmToken?: string
  pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
  country?: string
  city?: string
}

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase()

/**
 * GET (invoked by Vercel Cron every 3 minutes) — Re-send delivery request push to
 * online drivers for any order that has been waiting for a driver longer than 3 minutes
 * without being accepted. Once a driver accepts, deliveryRequestedAt is cleared so
 * the order drops out of this query automatically.
 *
 * On acceptance, the business is notified via sendTenantAndStaffPush (this is also
 * handled in /api/driver/orders/[orderId]/accept, this cron only handles the re-ping).
 *
 * Secured by CRON_SECRET.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const pushReady = isFCMConfigured() || isPushConfigured()
  if (!pushReady) return NextResponse.json({ ok: true, retriedCount: 0, reason: 'push not configured' })

  // Orders still waiting for a driver (deliveryRequestedAt set, no assignedDriver)
  const cutoffIso = new Date(Date.now() - RETRY_INTERVAL_MS).toISOString()
  const pendingOrders = await writeClient.fetch<PendingOrder[]>(
    `*[
      _type == "order" &&
      defined(deliveryRequestedAt) &&
      !defined(assignedDriver) &&
      status in ["new", "preparing", "waiting_for_delivery"] &&
      (
        !defined(lastDeliveryRequestPingAt) && deliveryRequestedAt <= $cutoff
        || defined(lastDeliveryRequestPingAt) && lastDeliveryRequestPingAt <= $cutoff
      )
    ]{
      _id,
      "siteRef": site._ref,
      totalAmount,
      deliveryFee,
      currency,
      "deliveryAreaNameAr": deliveryArea->name_ar,
      "deliveryAreaNameEn": deliveryArea->name_en,
      "declinedByDriverRefs": declinedByDriverIds[]._ref,
      deliveryRequestedAt,
      lastDeliveryRequestPingAt
    }`,
    { cutoff: cutoffIso }
  )

  if (!pendingOrders?.length) {
    return NextResponse.json({ ok: true, retriedCount: 0 })
  }

  const nowIso = new Date().toISOString()
  let retriedCount = 0

  for (const order of pendingOrders) {
    try {
      // Resolve business name and tenant location for driver matching
      let businessName = 'توصيل'
      let tenantCountry: string | undefined
      let tenantCity: string | undefined

      if (order.siteRef) {
        const [businessInfo, tenantDoc] = await Promise.all([
          writeClient.fetch<{ name_ar?: string; name_en?: string } | null>(
            `*[_type == "restaurantInfo" && site._ref == $siteId][0]{ name_ar, name_en }`,
            { siteId: order.siteRef }
          ),
          writeClient.fetch<{ name?: string; country?: string; city?: string } | null>(
            `*[_type == "tenant" && _id == $id][0]{ name, country, city }`,
            { id: order.siteRef }
          ),
        ])
        const ar = businessInfo?.name_ar?.trim()
        const en = businessInfo?.name_en?.trim()
        businessName = ar || en || tenantDoc?.name?.trim() || businessName
        tenantCountry = tenantDoc?.country
        tenantCity = tenantDoc?.city
      }

      const currency = order.currency?.trim() || '₪'
      const total = typeof order.totalAmount === 'number' ? order.totalAmount.toFixed(2) : '0.00'
      const fee = typeof order.deliveryFee === 'number' ? order.deliveryFee.toFixed(2) : '0.00'
      const areaName =
        order.deliveryAreaNameAr?.trim() || order.deliveryAreaNameEn?.trim() || ''
      const bodyAr = areaName
        ? `${businessName} - عليك دفع ${total} ${currency} - التوصيل ${fee} ${currency} (${areaName})`
        : `${businessName} - عليك دفع ${total} ${currency} - التوصيل ${fee} ${currency}`

      const payload = {
        title: RTL_MARK + 'طلب توصيل جديد',
        body: RTL_MARK + bodyAr,
        url: '/driver/orders',
        dir: 'rtl' as const,
      }

      // Find online drivers in same city (excluding those who declined)
      const declinedSet = new Set(order.declinedByDriverRefs ?? [])
      const allOnlineDrivers = await writeClient.fetch<DriverRow[]>(
        `*[_type == "driver" && isOnline == true && (defined(fcmToken) || defined(pushSubscription.endpoint))]{
          _id, fcmToken, "pushSubscription": pushSubscription, country, city
        }`
      )

      let matching: DriverRow[] = (allOnlineDrivers ?? []).filter((d) => !declinedSet.has(d._id))
      if (tenantCountry && tenantCity) {
        const cc = norm(tenantCountry)
        const ci = norm(tenantCity)
        const sameCity = matching.filter(
          (d) => norm(d.country) === cc && norm(d.city) === ci
        )
        if (sameCity.length > 0) matching = sameCity
      }

      for (const d of matching) {
        let sent = false
        if (d.fcmToken && isFCMConfigured()) {
          sent = await sendFCMToToken(d.fcmToken, payload)
        }
        if (!sent) {
          const sub = d.pushSubscription
          if (sub?.endpoint && sub?.p256dh && sub?.auth && isPushConfigured()) {
            await sendPushNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            )
          }
        }
      }

      // Update ping timestamp so we don't re-send for another 3 minutes
      await writeClient.patch(order._id).set({ lastDeliveryRequestPingAt: nowIso }).commit()
      retriedCount++
    } catch (e) {
      console.error('[cron/retry-delivery-requests] Failed for order', order._id, e)
    }
  }

  return NextResponse.json({ ok: true, retriedCount })
}
