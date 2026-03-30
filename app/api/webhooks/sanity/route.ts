import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { pusherServer } from '@/lib/pusher'
import { isValidSignature, SIGNATURE_HEADER_NAME } from '@sanity/webhook'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'
import { sendTenantAndStaffPush } from '@/lib/tenant-and-staff-push'

/** Document types whose changes can affect the customer-facing menu pages. */
const MENU_AFFECTING_TYPES = new Set([
  'product',
  'category',
  'tenant',
  'catalogProduct',
  'masterCatalogProduct',
  'restaurantInfo',
  'aboutUs',
])

import { getAdminVerifiedPushAr } from '@/lib/driver-push-messages'

const secret = process.env.SANITY_WEBHOOK_SECRET
const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get(SIGNATURE_HEADER_NAME)
    const body = await req.text()

    if (secret && signature) {
      if (!isValidSignature(body, signature, secret)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const payload = JSON.parse(body)
    const { _type, _id, site, customer, orderType, clerkUserId } = payload

    if (_type === 'order') {
      const siteId = site?._ref
      const customerId = customer?._ref

      const triggerPromises: Promise<any>[] = []

      // Notify the specific tenant
      if (siteId) {
        triggerPromises.push(pusherServer.trigger(`tenant-${siteId}`, 'order-update', { orderId: _id }))
      }

      // Notify the specific customer
      if (customerId) {
        triggerPromises.push(pusherServer.trigger(`customer-${customerId}`, 'order-update', { orderId: _id }))
      }

      // Notify the specific order channel (for tracking links where customer isn't logged in)
      triggerPromises.push(pusherServer.trigger(`order-${_id}`, 'order-update', { orderId: _id }))

      // Notify drivers if it's a delivery order
      if (orderType === 'delivery') {
        triggerPromises.push(pusherServer.trigger('driver-global', 'order-update', { orderId: _id }))
      }

      await Promise.all(triggerPromises)

      // Backup: Send FCM push notification if it hasn't been sent yet
      if (siteId && token) {
        try {
          const orderDoc = await writeClient.fetch<{
            tenantNewOrderPushSent?: boolean
            orderNumber?: string
            scheduledFor?: string
          }>(`*[_type == "order" && _id == $_id][0]{ tenantNewOrderPushSent, orderNumber, scheduledFor }`, { _id })

          if (orderDoc && !orderDoc.tenantNewOrderPushSent) {
            const tenantDoc = await writeClient.fetch<{ name?: string; name_ar?: string; slug?: string } | null>(
              `*[_type == "tenant" && _id == $id][0]{ name, name_ar, "slug": slug.current }`,
              { id: siteId }
            )

            const businessName = tenantDoc?.name_ar || tenantDoc?.name || tenantDoc?.slug || siteId
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
            const base = baseUrl ? baseUrl.replace(/\/$/, '') : ''
            const slug = (tenantDoc?.slug ?? '').trim()
            const path = slug ? `/t/${slug}/orders?open=${encodeURIComponent(_id)}` : '/orders'
            const url = `${base}${path}`
            const icon = slug ? `${base}/t/${slug}/icon/192` : `${base}/adminslogo.webp`

            const isScheduled = !!orderDoc.scheduledFor
            const titleText = isScheduled 
              ? `${businessName}: طلب مجدول جديد — #${orderDoc.orderNumber || _id.slice(-6)}`
              : `${businessName}: طلب جديد — #${orderDoc.orderNumber || _id.slice(-6)}`

            const pushPayload = {
              title: titleText,
              body: 'تم استلام طلب جديد. افتح التطبيق للمراجعة والقبول.',
              url,
              icon,
              dir: 'rtl' as const,
            }

            const sent = await sendTenantAndStaffPush(siteId, pushPayload)
            if (sent) {
              await writeClient.patch(_id).set({
                tenantNewOrderPushSent: true,
                tenantNewOrderPushSentAt: new Date().toISOString()
              }).commit()
              console.log(`[Webhook] Sent backup FCM for new order ${_id}`)
            }
          }
        } catch (e) {
          console.error('[Webhook] Failed to process backup FCM for new order:', e)
        }
      }
    } else if (_type === 'driver') {
      // Check for welcome notification (only once per driver)
      if (token) {
        try {
          const fullDriver = await writeClient.fetch<{ isVerifiedByAdmin?: boolean; welcomeFcmSent?: boolean; fcmToken?: string; pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }; nickname?: string }>(`*[_type == "driver" && _id == $_id][0]`, { _id })
          if (fullDriver?.isVerifiedByAdmin && !fullDriver?.welcomeFcmSent) {
            // Set flag FIRST so any re-triggered webhook (from this patch) sees it and skips sending again
            await writeClient.patch(_id).set({ welcomeFcmSent: true }).commit()

            const pushData = getAdminVerifiedPushAr(fullDriver.nickname)
            const payload = { title: pushData.title, body: pushData.body, url: '/driver/orders' }
            let sent = false

            if (fullDriver.fcmToken && isFCMConfigured()) {
              sent = await sendFCMToToken(fullDriver.fcmToken, payload)
            }
            if (!sent && fullDriver.pushSubscription?.endpoint && fullDriver.pushSubscription?.p256dh && fullDriver.pushSubscription?.auth && isPushConfigured()) {
              await sendPushNotification({ endpoint: fullDriver.pushSubscription.endpoint, keys: { p256dh: fullDriver.pushSubscription.p256dh, auth: fullDriver.pushSubscription.auth } }, payload)
            }
          }
        } catch (e) {
          console.error('[Webhook] Failed to process driver welcome notification:', e)
        }
      }

      // Driver status updates
      if (clerkUserId) {
        await pusherServer.trigger(`driver-${clerkUserId}`, 'driver-update', { driverId: _id })
      }
    } else if (_type === 'tenant' || _type === 'category' || _type === 'product') {
      // General tenant changes
      const siteId = _type === 'tenant' ? _id : site?._ref
      if (siteId) {
        await pusherServer.trigger(`tenant-${siteId}`, 'menu-update', { type: _type })
      }
    }

    // Invalidate Next.js ISR cache for all business menu pages when any
    // menu-affecting document changes — this includes Super Admin catalog
    // image/description edits which were previously invisible until the
    // 1-hour TTL expired.
    if (MENU_AFFECTING_TYPES.has(_type)) {
      revalidateTag('store-page', 'default')
      revalidateTag('bedi-dev.store-page', 'default')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Sanity webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
