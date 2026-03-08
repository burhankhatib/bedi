/**
 * Send push notification to customer when their order status changes.
 * Uses customer name and business name for personalization.
 * Click opens the token-based tracking page (no phone auth).
 */

import { client } from '@/sanity/lib/client'
import { sendPushNotificationDetailed, isPushConfigured } from '@/lib/push'
import { sendFCMToTokenDetailed, isFCMConfigured } from '@/lib/fcm'
import { getActiveSubscriptionsForUser, markSubscriptionInactive } from '@/lib/user-push-subscriptions'

const STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  new: { en: 'Order received', ar: 'تم استلام الطلب' },
  acknowledged: { en: 'Order received and scheduled', ar: 'تم استلام وجدولة الطلب' },
  preparing: { en: 'Preparing your order', ar: 'قيد التحضير' },
  waiting_for_delivery: { en: 'Waiting for delivery', ar: 'في انتظار التوصيل' },
  driver_on_the_way: { en: 'Driver on the way to the store', ar: 'السائق في الطريق إلى المتجر' },
  'out-for-delivery': { en: 'Driver on the way to you', ar: 'السائق في الطريق إليك' },
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
}

/**
 * Send a single push to the customer for this order when status changes.
 * No-op if push is not configured or order has no subscription.
 */
export async function sendCustomerOrderStatusPush(options: SendCustomerOrderPushOptions): Promise<boolean> {
  const { orderId, newStatus, baseUrl = '' } = options
  if (!isFCMConfigured() && !isPushConfigured()) return false

  const order = await client.fetch<{
    customerName?: string
    trackingToken?: string
    siteRef?: string
    customerRef?: string
    customerFcmToken?: string
    customerPushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
  } | null>(
    `*[_type == "order" && _id == $orderId][0]{
      customerName,
      trackingToken,
      "siteRef": site._ref,
      "customerRef": customer._ref,
      customerFcmToken,
      "customerPushSubscription": customerPushSubscription
    }`,
    { orderId }
  )
  if (!order?.trackingToken) return false

  const tenantId = order.siteRef
  if (!tenantId) return false

  const combined = await client.fetch<{
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
  const businessName = (restaurant?.name_en || restaurant?.name_ar || '').trim() || 'Store'
  const label = statusLabel(newStatus, 'en')
  const labelAr = statusLabel(newStatus, 'ar')
  const title = `${customerName}, your order at ${businessName}`
  const titleAr = `${customerName}، طلبك من ${businessName}`
  const body = label
  const bodyAr = labelAr
  const path = `/t/${slug}/track/${order.trackingToken}`
  const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path

  const payload = { title: `${title} — ${body}`, body: body, url }
  const payloadAr = { title: `${titleAr} — ${bodyAr}`, body: bodyAr, url }
  const useAr = true
  const finalPayload = useAr ? payloadAr : payload

  const recipients: Array<{
    subscriptionId?: string
    fcmToken?: string
    webPush?: { endpoint?: string; p256dh?: string; auth?: string }
    source: 'central' | 'legacy'
  }> = []

  if (order.customerRef) {
    const customer = await client.fetch<{ clerkUserId?: string } | null>(
      `*[_type == "customer" && _id == $id][0]{ clerkUserId }`,
      { id: order.customerRef }
    )
    const clerkUserId = (customer?.clerkUserId ?? '').trim()
    if (clerkUserId) {
      const subs = await getActiveSubscriptionsForUser({
        clerkUserId,
        roleContext: 'customer',
      })
      for (const sub of subs) {
        recipients.push({
          subscriptionId: sub._id,
          fcmToken: sub.fcmToken,
          webPush: sub.webPush,
          source: 'central',
        })
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
  const dedupedRecipients: typeof recipients = []
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
  let permanentInactiveCount = 0
  for (const recipient of dedupedRecipients) {
    let delivered = false

    if (recipient.fcmToken && isFCMConfigured()) {
      const fcmResult = await sendFCMToTokenDetailed(recipient.fcmToken, finalPayload)
      if (fcmResult.ok) {
        delivered = true
      } else if (recipient.source === 'central' && recipient.subscriptionId && fcmResult.permanent) {
        permanentInactiveCount += 1
        await markSubscriptionInactive({
          id: recipient.subscriptionId,
          reason: fcmResult.reason || 'fcm_permanent_failure',
        })
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
        } else if (recipient.source === 'central' && recipient.subscriptionId && pushResult.permanent) {
          permanentInactiveCount += 1
          await markSubscriptionInactive({
            id: recipient.subscriptionId,
            reason: pushResult.reason || 'webpush_permanent_failure',
          })
        }
      }
    }

    if (delivered) sentAny = true
  }

  console.info('[customer-order-push] fanout', {
    orderId,
    status: newStatus,
    recipients: dedupedRecipients.length,
    source: hasCentralRecipients ? 'central' : 'legacy',
    sentAny,
    permanentInactiveCount,
  })

  return sentAny
}
