import { sendTenantAndStaffPush } from '@/lib/tenant-and-staff-push'
import { sendWhatsAppTemplateMessage } from '@/lib/meta-whatsapp'
import { pusherServer } from '@/lib/pusher'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isPushConfigured } from '@/lib/push'
import { isFCMConfigured } from '@/lib/fcm'
import { sendCustomerOrderStatusPush } from '@/lib/customer-order-push'
import { sendTenantOrderUpdatePush, TenantOrderPushStatus } from '@/lib/tenant-order-push'

const writeClient = client.withConfig({
  token: token,
  useCdn: false,
})

export const NotificationService = {
  /**
   * Fires immediate notifications when a new order is placed.
   * Includes Pusher real-time update, FCM Push Notification, and WhatsApp Message.
   */
  async onNewOrder(params: {
    orderId: string
    orderNumber: string
    tenantId: string
    tenantSlug: string
    tenantName?: string
    tenantNameAr?: string
    tenantPhone?: string
  }) {
    const { orderId, orderNumber, tenantId, tenantSlug, tenantName, tenantNameAr, tenantPhone } = params
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const base = baseUrl ? baseUrl.replace(/\/$/, '') : ''
    const path = tenantSlug ? `/t/${tenantSlug}/orders` : '/orders'
    const url = `${base}${path}`
    const icon = tenantSlug ? `${base}/t/${tenantSlug}/icon/192` : `${base}/adminslogo.webp`
    const businessName = tenantNameAr || tenantName || tenantSlug || tenantId

    // 1. Pusher update for live UI
    try {
      await pusherServer.trigger(`tenant-${tenantId}`, 'order-update', { orderId })
    } catch (e) {
      console.error('[NotificationService] Pusher trigger failed:', e)
    }

    // 2. FCM Push Notification for Tenant and Staff
    const pushReady = isFCMConfigured() || isPushConfigured()
    if (pushReady) {
      try {
        const pushPayload = {
          title: `${businessName}: طلب جديد — #${orderNumber || orderId.slice(-6)}`,
          body: 'تم استلام طلب جديد. افتح التطبيق للمراجعة والقبول.',
          url,
          icon,
          dir: 'rtl' as const,
        }

        const sent = await sendTenantAndStaffPush(tenantId, pushPayload)
        
        if (sent) {
          // Mark as sent in Sanity
          await writeClient.patch(orderId).set({ tenantNewOrderPushSent: true }).commit()
        } else {
          console.warn('[NotificationService] sendTenantAndStaffPush returned false (not sent).')
        }
      } catch (e) {
        console.error('[NotificationService] Push notification on new order failed:', e)
      }
    }

    // 3. WhatsApp Notification for Business Owner
    if (tenantPhone) {
      try {
        const phone = tenantPhone.trim()
        if (phone) {
          // Send WhatsApp template
          // We use the tenantSlug/orders as the parameter if required by your template
          // Adjust parameter format to match what's expected in your Meta setup
          const targetUrl = tenantSlug ? `${tenantSlug}/orders` : 'orders'
          
          const waResult = await sendWhatsAppTemplateMessage(
            phone,
            'new_order',
            [businessName], // Note: Template uses {{1}} for businessName
            'ar_EG',
            targetUrl
          )

          if (waResult.success) {
            await writeClient.patch(orderId).set({ businessWhatsappNotifiedAt: new Date().toISOString() }).commit()
          } else {
            console.error(`[NotificationService] Failed to send WhatsApp to ${phone} for order ${orderId}`, waResult.error)
          }
        }
      } catch (e) {
        console.error('[NotificationService] WhatsApp notification failed:', e)
      }
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
