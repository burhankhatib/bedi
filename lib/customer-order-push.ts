/**
 * Send push notification to customer when their order status changes.
 * Uses customer name and business name for personalization.
 * Click opens the token-based tracking page (no phone auth).
 *
 * IMPORTANT: Uses clientNoCdn so freshly-saved subscriptions are always visible.
 */

import { clientNoCdn } from '@/sanity/lib/client'
import { sendPushNotificationDetailed, isPushConfigured } from '@/lib/push'
import { sendFCMToTokenDetailed, isFCMConfigured } from '@/lib/fcm'
import { getActiveSubscriptionsForUser, removeDevice } from '@/lib/user-push-subscriptions'

const STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  new: { en: 'Order received', ar: 'تم استلام الطلب' },
  acknowledged: { en: 'Order received and scheduled', ar: 'تم استلام وجدولة الطلب' },
  schedule_updated: { en: 'Your scheduled order time has been updated', ar: 'تم تحديث وقت طلبك المجدول' },
  preparing: { en: 'Your order is being carefully prepared', ar: 'يتم تحضير طلبك بعناية' },
  waiting_for_delivery: { en: 'Waiting for delivery', ar: 'في انتظار التوصيل' },
  driver_on_the_way: { en: 'Driver on the way to the store', ar: 'السائق في الطريق إلى المتجر' },
  'out-for-delivery': { en: 'Driver on the way to you', ar: 'السائق في الطريق إليك' },
  'driver-arrived': { en: 'Driver has arrived!', ar: 'السائق وصل!' },
  completed: { en: 'Completed', ar: 'مكتمل' },
  served: { en: 'Served', ar: 'تم التقديم' },
  cancelled: { en: 'Cancelled', ar: 'ملغى' },
  refunded: { en: 'Refunded', ar: 'مسترد' },
}

function statusLabel(status: string, lang: 'en' | 'ar' = 'en'): string {
  const s = STATUS_LABELS[status] ?? STATUS_LABELS.new
  return lang === 'ar' ? s.ar : s.en
}

export type SendCustomerOrderPushOptions = {
  orderId: string
  newStatus: string
  /** Optional base URL for tracking link (e.g. process.env.NEXT_PUBLIC_APP_URL). If missing, URL is path-only. */
  baseUrl?: string
  /** When status is out-for-delivery, estimated minutes until delivery (includes buffer). */
  estimatedDeliveryMinutes?: number
}

/**
 * Send a single push to the customer for this order when status changes.
 * No-op if push is not configured or order has no subscription.
 */
export async function sendCustomerOrderStatusPush(options: SendCustomerOrderPushOptions): Promise<boolean> {
  const { orderId, newStatus, baseUrl = '', estimatedDeliveryMinutes } = options
  if (!isFCMConfigured() && !isPushConfigured()) return false

  const order = await clientNoCdn.fetch<{
    customerName?: string
    trackingToken?: string
    siteRef?: string
    customerRef?: string
    customerFcmToken?: string
    customerPushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
    assignedDriverName?: string
  } | null>(
    `*[_type == "order" && _id == $orderId][0]{
      customerName,
      trackingToken,
      "siteRef": site._ref,
      "customerRef": customer._ref,
      customerFcmToken,
      "customerPushSubscription": customerPushSubscription,
      "assignedDriverName": assignedDriver->name
    }`,
    { orderId }
  )
  if (!order?.trackingToken) return false

  const tenantId = order.siteRef
  if (!tenantId) return false

  const combined = await clientNoCdn.fetch<{
    tenant: { slug?: string } | null
    restaurant: { name_en?: string; name_ar?: string } | null
  }>(
    `{
      "tenant": *[_type == "tenant" && _id == $id][0]{ "slug": slug.current },
      "restaurant": *[_type == "restaurantInfo" && site._ref == $id][0]{ name_en, name_ar }
    }`,
    { id: tenantId }
  )
  const tenant = combined.tenant
  const restaurant = combined.restaurant
  const slug = tenant?.slug
  if (!slug) return false

  const customerName = (order.customerName ?? '').trim() || 'Customer'
  const businessName = (restaurant?.name_ar || restaurant?.name_en || '').trim() || 'المتجر'
  const businessNameEn = (restaurant?.name_en || restaurant?.name_ar || '').trim() || 'Store'
  const driverName = order.assignedDriverName

  let label = statusLabel(newStatus, 'en')
  let labelAr = statusLabel(newStatus, 'ar')

  if (newStatus === 'new') {
    label = `Order sent to ${businessNameEn}`
    labelAr = `تم إرسال الطلب إلى ${businessName}`
  } else if (newStatus === 'driver_on_the_way') {
    if (driverName) {
      label = `Driver ${driverName} is on the way to ${businessNameEn}`
      labelAr = `السائق ${driverName} في الطريق إلى ${businessName}`
    } else {
      label = `Driver is on the way to ${businessNameEn}`
      labelAr = `السائق في الطريق إلى ${businessName}`
    }
  } else if (newStatus === 'out-for-delivery') {
    const etaSuffix = estimatedDeliveryMinutes
      ? ` — ~${estimatedDeliveryMinutes} min`
      : ''
    const etaSuffixAr = estimatedDeliveryMinutes
      ? ` — ~${estimatedDeliveryMinutes} دقيقة`
      : ''
    if (driverName) {
      label = `${driverName} is on the way to you${etaSuffix}`
      labelAr = `${driverName} في الطريق إليك${etaSuffixAr}`
    } else {
      label = `Driver is on the way to you${etaSuffix}`
      labelAr = `السائق في الطريق إليك${etaSuffixAr}`
    }
  }

  const title = `${customerName}, your order at ${businessNameEn}`
  const titleAr = `${customerName}، طلبك من ${businessName}`
  const body = label
  const bodyAr = labelAr
  const path = `/t/${slug}/track/${order.trackingToken}`
  const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path

  const isDriverArrived = newStatus === 'driver-arrived'
  const baseData = isDriverArrived ? { driverArrived: '1' } : undefined
  const payload = {
    title: `${title} — ${body}`,
    body,
    url,
    ...(baseData && { data: baseData }),
    ...(isDriverArrived && { driverArrived: '1' as const }),
  }
  const payloadAr = {
    title: `${titleAr} — ${bodyAr}`,
    body: bodyAr,
    url,
    ...(baseData && { data: baseData }),
    ...(isDriverArrived && { driverArrived: '1' as const }),
  }
  const useAr = true
  const finalPayload = useAr ? payloadAr : payload

  type Recipient = {
    clerkUserId?: string
    fcmToken?: string
    webPush?: { endpoint?: string; p256dh?: string; auth?: string }
    source: 'central' | 'legacy'
  }
  const recipients: Recipient[] = []

  if (order.customerRef) {
    const customer = await clientNoCdn.fetch<{ clerkUserId?: string } | null>(
      `*[_type == "customer" && _id == $id][0]{ clerkUserId }`,
      { id: order.customerRef }
    )
    const clerkUserId = (customer?.clerkUserId ?? '').trim()
    if (clerkUserId) {
      const subs = await getActiveSubscriptionsForUser({
        clerkUserId,
        roleContext: 'customer',
      })
      // Each subscription doc has a devices[] array — fan out to every device
      for (const sub of subs) {
        if (Array.isArray(sub.devices)) {
          for (const device of sub.devices) {
            recipients.push({
              clerkUserId,
              fcmToken: device.fcmToken,
              webPush: device.webPush,
              source: 'central',
            })
          }
        }
      }
    }
  }

  const hasCentralRecipients = recipients.length > 0
  if (!hasCentralRecipients) {
    recipients.push({
      fcmToken: order.customerFcmToken,
      webPush: order.customerPushSubscription,
      source: 'legacy',
    })
  }

  // Deduplicate fanout targets to avoid sending duplicate notifications to same device.
  const dedupedRecipients: Recipient[] = []
  const seenKeys = new Set<string>()
  for (const recipient of recipients) {
    const key =
      recipient.fcmToken?.trim()
        ? `fcm:${recipient.fcmToken.trim()}`
        : recipient.webPush?.endpoint?.trim()
          ? `web:${recipient.webPush.endpoint.trim()}`
          : ''
    if (!key || seenKeys.has(key)) continue
    seenKeys.add(key)
    dedupedRecipients.push(recipient)
  }

  let sentAny = false
  const cleanupPromises: Promise<void>[] = []
  for (const recipient of dedupedRecipients) {
    let delivered = false

    if (recipient.fcmToken && isFCMConfigured()) {
      const fcmResult = await sendFCMToTokenDetailed(recipient.fcmToken, finalPayload)
      if (fcmResult.ok) {
        delivered = true
      } else if (recipient.source === 'central' && recipient.clerkUserId && fcmResult.permanent) {
        cleanupPromises.push(
          removeDevice({
            clerkUserId: recipient.clerkUserId,
            roleContext: 'customer',
            fcmToken: recipient.fcmToken,
          })
        )
      }
    }

    if (!delivered) {
      const sub = recipient.webPush
      if (sub?.endpoint && sub?.p256dh && sub?.auth && isPushConfigured()) {
        const pushResult = await sendPushNotificationDetailed(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          finalPayload
        )
        if (pushResult.ok) {
          delivered = true
        } else if (recipient.source === 'central' && recipient.clerkUserId && pushResult.permanent) {
          cleanupPromises.push(
            removeDevice({
              clerkUserId: recipient.clerkUserId,
              roleContext: 'customer',
              endpoint: sub.endpoint,
            })
          )
        }
      }
    }

    if (delivered) sentAny = true
  }

  // Fire-and-forget device cleanup
  if (cleanupPromises.length > 0) {
    Promise.all(cleanupPromises).catch((e) => console.warn('[customer-order-push] device cleanup error', e))
  }

  console.info('[customer-order-push] fanout', {
    orderId,
    status: newStatus,
    recipients: dedupedRecipients.length,
    source: hasCentralRecipients ? 'central' : 'legacy',
    sentAny,
    permanentFailures: cleanupPromises.length,
  })

  if (!sentAny && dedupedRecipients.length > 0) {
    console.warn(`[customer-order-push] ⚠️ PUSH NOT DELIVERED for order ${orderId}, status=${newStatus}, targets=${dedupedRecipients.length}`)
  }

  return sentAny
}
