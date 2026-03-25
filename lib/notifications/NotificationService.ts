import { sendTenantAndStaffPush } from '@/lib/tenant-and-staff-push'
import { pusherServer } from '@/lib/pusher'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isPushConfigured } from '@/lib/push'
import { isFCMConfigured } from '@/lib/fcm'
import { sendCustomerOrderStatusPush } from '@/lib/customer-order-push'
import { sendTenantOrderUpdatePush, TenantOrderPushStatus } from '@/lib/tenant-order-push'
import { appendOrderNotificationDiagnostic } from '@/lib/notification-diagnostics'
import { notifyBusinessWhatsappForOrder } from '@/lib/business-whatsapp-notifier'

const writeClient = client.withConfig({
  token: token,
  useCdn: false,
})

export const NotificationService = {
  /**
   * Fires immediate notifications when a new order is placed.
   * 1) Pusher + FCM/Web Push to tenant staff (always when configured).
   * 2) Instant WhatsApp (new_order_v2 + full order summary) when recipients exist — same path as OTP reliability.
   *    The 3-minute-unaccepted reminder is scheduled separately (businessWhatsappUnacceptedReminderAt).
   */
  async onNewOrder(params: {
    orderId: string
    orderNumber: string
    tenantId: string
    tenantSlug: string
    tenantName?: string
    tenantNameAr?: string
    tenantPhone?: string
    /** @deprecated No longer gates WhatsApp; kept for API compatibility with callers. */
    prioritizeWhatsapp?: boolean
  }) {
    const { orderId, orderNumber, tenantId, tenantSlug, tenantName, tenantNameAr, tenantPhone } = params
    let slug = (tenantSlug || '').trim()
    if (!slug && tenantId) {
      const t = await writeClient.fetch<{ slug?: string } | null>(
        `*[_type == "tenant" && _id == $id][0]{ "slug": slug.current }`,
        { id: tenantId }
      )
      slug = (t?.slug ?? '').trim()
    }
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const base = baseUrl ? baseUrl.replace(/\/$/, '') : ''
    const path = slug ? `/t/${slug}/orders?open=${encodeURIComponent(orderId)}` : '/orders'
    const url = `${base}${path}`
    const icon = slug ? `${base}/t/${slug}/icon/192` : `${base}/adminslogo.webp`
    const businessName = tenantNameAr || tenantName || tenantSlug || tenantId

    // 1. Pusher update for live UI
    try {
      await pusherServer.trigger(`tenant-${tenantId}`, 'order-update', { orderId })
    } catch (e) {
      console.error('[NotificationService] Pusher trigger failed:', e)
    }

    // 2. FCM Push Notification for Tenant and Staff
    const pushReady = isFCMConfigured() || isPushConfigured()
    if (!pushReady) {
      console.warn('[NotificationService] Push skipped — FCM and Web Push not configured')
      await appendOrderNotificationDiagnostic(writeClient, orderId, {
        source: 'NotificationService.onNewOrder.push',
        level: 'warn',
        message: 'Push not attempted: neither FCM nor Web Push (VAPID) is configured on the server',
        detail: { tenantId },
      })
    } else {
      try {
        const orderDoc = await writeClient.fetch<{
          scheduledFor?: string
          deliveryRequestedAt?: string
          orderType?: string
        }>(`*[_type == "order" && _id == $orderId][0]{ scheduledFor, deliveryRequestedAt, orderType }`, { orderId })

        const isScheduled = !!orderDoc?.scheduledFor
        const isDriverPickupAutoDispatch =
          orderDoc?.orderType === 'delivery' && !!orderDoc?.deliveryRequestedAt
        const titleText = isScheduled 
          ? `${businessName}: طلب مجدول جديد — #${orderNumber || orderId.slice(-6)}`
          : `${businessName}: طلب جديد — #${orderNumber || orderId.slice(-6)}`

        const pushPayload = {
          title: titleText,
          body: isDriverPickupAutoDispatch
            ? 'تم استلام طلب جديد وتم إرساله تلقائياً للسائقين. يمكنك المتابعة من صفحة الطلبات.'
            : 'تم استلام طلب جديد. افتح التطبيق للمراجعة والقبول.',
          url,
          icon,
          dir: 'rtl' as const,
        }

        const sent = await sendTenantAndStaffPush(tenantId, pushPayload, { eventType: 'new_order' })
        
        if (sent) {
          // Mark as sent in Sanity
          await writeClient.patch(orderId).set({ 
            tenantNewOrderPushSent: true,
            tenantNewOrderPushSentAt: new Date().toISOString()
          }).commit()
        } else {
          console.warn(`[NotificationService] No FCM/Web Push sent for new order ${orderId} – check tenant/staff subscriptions and FCM config.`)
          await appendOrderNotificationDiagnostic(writeClient, orderId, {
            source: 'NotificationService.onNewOrder.push',
            level: 'warn',
            message: 'Push attempted but no device accepted delivery (check userPushSubscription / tenant tokens)',
            detail: { tenantId, fcmConfigured: isFCMConfigured(), webPushConfigured: isPushConfigured() },
          })
        }
      } catch (e) {
        console.error('[NotificationService] Push notification on new order failed:', e)
        await appendOrderNotificationDiagnostic(writeClient, orderId, {
          source: 'NotificationService.onNewOrder.push',
          level: 'error',
          message: 'Push dispatch threw',
          detail: { tenantId, error: e instanceof Error ? e.message : String(e) },
        })
      }
    }

    // 3. Instant WhatsApp — always attempted (recipients resolved in notifyBusinessWhatsappForOrder)
    if (!tenantPhone?.trim()) {
      await appendOrderNotificationDiagnostic(writeClient, orderId, {
        source: 'NotificationService.onNewOrder.whatsapp',
        level: 'warn',
        message: 'Tenant ownerPhone is empty; trying other business WhatsApp recipients',
        detail: { tenantId },
      })
    }
    try {
      await notifyBusinessWhatsappForOrder({
        writeClient,
        orderId,
        tenantId,
        tenantSlug: slug,
        tenantName,
        tenantNameAr,
        mode: 'instant',
      })
    } catch (e) {
      console.error('[NotificationService] WhatsApp notification failed:', e)
      await appendOrderNotificationDiagnostic(writeClient, orderId, {
        source: 'NotificationService.onNewOrder.whatsapp',
        level: 'error',
        message: 'Instant WhatsApp dispatch threw',
        detail: { error: e instanceof Error ? e.message : String(e) },
      })
    }
  },

  /**
   * Fires notifications when an order status is updated (or scheduled time is updated).
   * Includes FCM Push Notifications to the Customer and the Tenant.
   */
  async onOrderStatusUpdated(params: {
    orderId: string
    status: string
    isScheduleUpdate?: boolean
  }) {
    const { orderId, status, isScheduleUpdate } = params
    
    // Notify Customer
    try {
      await sendCustomerOrderStatusPush({
        orderId,
        newStatus: isScheduleUpdate ? 'schedule_updated' : status,
        baseUrl: process.env.NEXT_PUBLIC_APP_URL,
      })
    } catch (e) {
      console.warn('[NotificationService] customer-order-push failed:', e)
    }

    // Notify Tenant (unless it's just a schedule update they themselves performed,
    // though typically the tenant-order-push will handle business-side alerts if needed)
    try {
      // In the current flow, we notify tenant staff of the order update
      await sendTenantOrderUpdatePush({
        orderId,
        status: status as TenantOrderPushStatus,
        baseUrl: process.env.NEXT_PUBLIC_APP_URL,
      })
    } catch (e) {
      console.warn('[NotificationService] tenant-order-push failed:', e)
    }
  }
}
