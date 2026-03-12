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
    prioritizeWhatsapp?: boolean
  }) {
    const { orderId, orderNumber, tenantId, tenantSlug, tenantName, tenantNameAr, tenantPhone, prioritizeWhatsapp } = params
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
    const path = slug ? `/t/${slug}/orders` : '/orders'
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
    if (pushReady) {
      try {
        const orderDoc = await writeClient.fetch<{
          scheduledFor?: string
        }>(`*[_type == "order" && _id == $orderId][0]{ scheduledFor }`, { orderId })

        const isScheduled = !!orderDoc?.scheduledFor
        const titleText = isScheduled 
          ? `${businessName}: طلب مجدول جديد — #${orderNumber || orderId.slice(-6)}`
          : `${businessName}: طلب جديد — #${orderNumber || orderId.slice(-6)}`

        const pushPayload = {
          title: titleText,
          body: 'تم استلام طلب جديد. افتح التطبيق للمراجعة والقبول.',
          url,
          icon,
          dir: 'rtl' as const,
        }

        const sent = await sendTenantAndStaffPush(tenantId, pushPayload)
        
        if (sent) {
          // Mark as sent in Sanity
          await writeClient.patch(orderId).set({ 
            tenantNewOrderPushSent: true,
            tenantNewOrderPushSentAt: new Date().toISOString()
          }).commit()
        } else {
          console.warn(`[NotificationService] No FCM/Web Push sent for new order ${orderId} – check tenant/staff subscriptions and FCM config.`)
        }
      } catch (e) {
        console.error('[NotificationService] Push notification on new order failed:', e)
      }
    }

    // 3. WhatsApp Notification for Business Owner (Backup by default, instant if prioritizeWhatsapp)
    if (tenantPhone && prioritizeWhatsapp) {
      try {
        const phone = tenantPhone.trim()
        if (phone) {
          // Fetch order details for enhanced template
          const orderDoc = await writeClient.fetch<{
            customerName?: string
            customerPhone?: string
            orderType?: string
            deliveryAddress?: string
            totalAmount?: number
            currency?: string
            items?: Array<{ productName: string; productNameAr?: string; quantity: number; price: number; total: number }>
          }>(
            `*[_type == "order" && _id == $orderId][0]{
              customerName,
              customerPhone,
              orderType,
              deliveryAddress,
              totalAmount,
              currency,
              items[]{ productName, "productNameAr": product->title_ar, quantity, price, total }
            }`,
            { orderId }
          )

          // Format items list
          const itemsList = orderDoc?.items?.map(i => {
            const nameAr = i.productNameAr;
            const nameEn = i.productName;
            
            let itemText = `▪️ *${i.quantity}x* _${nameAr || nameEn || 'منتج غير معروف'}_ (${i.total} ${orderDoc.currency})`;
            if (nameAr && nameEn && nameAr !== nameEn) {
              itemText += `\r   └ _${nameEn}_`;
            }
            return itemText;
          }).join('\r\r') || 'لا توجد منتجات'
          
          // Format customer details
          const customerDetails = `👤 *الاسم:* ${orderDoc?.customerName || 'غير معروف'}\r📞 *الهاتف:* ${orderDoc?.customerPhone || 'غير متوفر'}\r🚚 *نوع الطلب:* *${orderDoc?.orderType === 'delivery' ? 'توصيل' : orderDoc?.orderType === 'dine-in' ? 'محلي' : 'استلام'}*${orderDoc?.deliveryAddress ? `\r📍 *العنوان:* _${orderDoc.deliveryAddress}_` : ''}`

          // Format full order summary
          const orderSummary = `🛒 *تفاصيل الطلب:*\r${itemsList}\r\r➖➖➖➖➖➖➖➖\r💰 *الإجمالي:* *${orderDoc?.totalAmount || 0} ${orderDoc?.currency || 'ILS'}*\r➖➖➖➖➖➖➖➖\r\r📋 *بيانات العميل:*\r${customerDetails}`

          // Send WhatsApp template
          // Assuming template 'new_order' uses {{1}} for businessName and {{2}} for order details
          const targetUrl = tenantSlug ? `${tenantSlug}/orders` : 'orders'
          
          const waResult = await sendWhatsAppTemplateMessage(
            phone,
            'new_order',
            [businessName, orderSummary], 
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
