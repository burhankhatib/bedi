import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { cleanWhatsAppRecipientPhone, sendTenantNewOrderWhatsApp } from '@/lib/send-tenant-new-order-whatsapp'
import { appendOrderNotificationDiagnostic } from '@/lib/notification-diagnostics'

export const dynamic = 'force-dynamic'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const m = authHeader?.match(/^Bearer\s+(.+)$/i)
  const bearer = m?.[1]?.trim() || ''
  const allowed = [process.env.CRON_SECRET, process.env.FIREBASE_JOB_SECRET].filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  )

  // Try to read secret from URL parameter as a fallback (for cron-job.org testing)
  const url = new URL(req.url)
  const secretParam = url.searchParams.get('secret')

  if (allowed.length && !allowed.includes(bearer) && !(secretParam && allowed.includes(secretParam))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  // Orders still not accepted (status == new): send WhatsApp reminder using the same enhanced
  // `new_order` template (full details + Maps/Waze) as instant notifications.
  // Gated by businessWhatsappUnacceptedReminderAt so instant WhatsApp (prioritizeWhatsapp) does not block this.
  // Time windows:
  // 1. Regular: created 3–120 minutes ago.
  // 2. Scheduled: notifyAt 3–120 minutes ago.
  const now = Date.now()
  const cutoff3m = new Date(now - 3 * 60 * 1000).toISOString()
  const cutoff2h = new Date(now - 2 * 60 * 60 * 1000).toISOString()
  const singleOrderId = url.searchParams.get('orderId')?.trim()

  if (singleOrderId) {
    try {
      const order = await writeClient.fetch<{
        _id: string
        tenantPhone?: string
        tenantName?: string
        tenantNameAr?: string
        tenantSlug?: string
        customerName?: string
        customerPhone?: string
        orderType?: string
        deliveryAddress?: string
        deliveryLat?: number
        deliveryLng?: number
        totalAmount?: number
        currency?: string
        items?: Array<{ productName: string; productNameAr?: string; quantity: number; price: number; total: number }>
      } | null>(
        `*[
          _type == "order" &&
          _id == $orderId &&
          status == "new" &&
          !defined(businessWhatsappUnacceptedReminderAt)
        ][0]{
          _id,
          "tenantPhone": site->ownerPhone,
          "tenantName": site->name,
          "tenantNameAr": site->name_ar,
          "tenantSlug": site->slug.current,
          customerName,
          customerPhone,
          orderType,
          deliveryAddress,
          deliveryLat,
          deliveryLng,
          totalAmount,
          currency,
          items[]{ productName, "productNameAr": product->title_ar, quantity, price, total }
        }`,
        { orderId: singleOrderId }
      )
      if (!order?._id) {
        return NextResponse.json({ ok: true, notifiedCount: 0, skipped: true })
      }
      const nowIso = new Date().toISOString()
      const phone = cleanWhatsAppRecipientPhone(order.tenantPhone)
      let notified = 0
      if (phone) {
        const businessName = order.tenantNameAr?.trim() || order.tenantName?.trim() || 'Business'
        const result = await sendTenantNewOrderWhatsApp({
          phone,
          businessName,
          tenantSlug: order.tenantSlug,
          orderSummaryInput: {
            currency: order.currency,
            items: order.items,
            totalAmount: order.totalAmount,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            orderType: order.orderType,
            deliveryAddress: order.deliveryAddress,
            deliveryLat: order.deliveryLat,
            deliveryLng: order.deliveryLng,
          },
        })
        if (result.success) {
          notified = 1
          await appendOrderNotificationDiagnostic(writeClient, order._id, {
            source: 'cron/unaccepted-orders-whatsapp',
            level: 'info',
            message: 'Unaccepted-order WhatsApp reminder sent (~3 min, still status new)',
            detail: { mode: 'single-order' },
          })
        } else {
          console.error(`[cron/unaccepted-orders-whatsapp] Failed to send for order ${order._id}`, result.error)
          await appendOrderNotificationDiagnostic(writeClient, order._id, {
            source: 'cron/unaccepted-orders-whatsapp',
            level: 'error',
            message: 'Unaccepted-order WhatsApp reminder send failed (all fallbacks)',
            detail: { mode: 'single-order', error: result.error, attempts: result.attempts },
          })
        }
      } else {
        await appendOrderNotificationDiagnostic(writeClient, order._id, {
          source: 'cron/unaccepted-orders-whatsapp',
          level: 'warn',
          message: 'Unaccepted-order WhatsApp reminder skipped: tenant has no ownerPhone',
          detail: { mode: 'single-order' },
        })
      }
      await writeClient
        .patch(order._id)
        .set({
          businessWhatsappUnacceptedReminderAt: nowIso,
          businessWhatsappNotifiedAt: nowIso,
        })
        .commit()
      return NextResponse.json({ ok: true, notifiedCount: notified, orderId: singleOrderId })
    } catch (error) {
      console.error('[cron/unaccepted-orders-whatsapp] single order failed:', error)
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
  }

  const allowLegacyScan = process.env.ENABLE_LEGACY_SANITY_SCAN_CRONS === 'true'
  if (!allowLegacyScan) {
    return NextResponse.json({ ok: true, notifiedCount: 0, skipped: true, reason: 'legacy-scan-disabled' })
  }

  try {
    const unacceptedOrders = await writeClient.fetch<{
      _id: string
      tenantPhone?: string
      tenantName?: string
      tenantNameAr?: string
      tenantSlug?: string
      customerName?: string
      customerPhone?: string
      orderType?: string
      deliveryAddress?: string
      deliveryLat?: number
      deliveryLng?: number
      totalAmount?: number
      currency?: string
      items?: Array<{ productName: string; productNameAr?: string; quantity: number; price: number; total: number }>
    }[]>(
      `*[
        _type == "order" &&
        status == "new" &&
        !defined(businessWhatsappUnacceptedReminderAt) &&
        (
          (createdAt <= $cutoff3m && createdAt >= $cutoff2h) ||
          (defined(scheduledFor) && defined(notifyAt) && notifyAt <= $cutoff3m && notifyAt >= $cutoff2h)
        )
      ]{
        _id,
        "tenantPhone": site->ownerPhone,
        "tenantName": site->name,
        "tenantNameAr": site->name_ar,
        "tenantSlug": site->slug.current,
        customerName,
        customerPhone,
        orderType,
        deliveryAddress,
        deliveryLat,
        deliveryLng,
        totalAmount,
        currency,
        items[]{ productName, "productNameAr": product->title_ar, quantity, price, total }
      }`,
      { cutoff3m, cutoff2h }
    )

    if (!unacceptedOrders?.length) {
      return NextResponse.json({ ok: true, notifiedCount: 0 })
    }

    let notifiedCount = 0
    const nowIso = new Date().toISOString()

    for (const order of unacceptedOrders) {
      try {
        const phone = cleanWhatsAppRecipientPhone(order.tenantPhone)
        if (phone) {
          const businessName = order.tenantNameAr?.trim() || order.tenantName?.trim() || 'Business'

          const result = await sendTenantNewOrderWhatsApp({
            phone,
            businessName,
            tenantSlug: order.tenantSlug,
            orderSummaryInput: {
              currency: order.currency,
              items: order.items,
              totalAmount: order.totalAmount,
              customerName: order.customerName,
              customerPhone: order.customerPhone,
              orderType: order.orderType,
              deliveryAddress: order.deliveryAddress,
              deliveryLat: order.deliveryLat,
              deliveryLng: order.deliveryLng,
            },
          })

          if (result.success) {
            notifiedCount++
            await appendOrderNotificationDiagnostic(writeClient, order._id, {
              source: 'cron/unaccepted-orders-whatsapp',
              level: 'info',
              message: 'Unaccepted-order WhatsApp reminder sent (legacy Sanity scan)',
              detail: { mode: 'legacy-scan' },
            })
          } else {
            console.error(`[cron/unaccepted-orders-whatsapp] Failed to send for order ${order._id}`, result.error)
            await appendOrderNotificationDiagnostic(writeClient, order._id, {
              source: 'cron/unaccepted-orders-whatsapp',
              level: 'error',
              message: 'Unaccepted-order WhatsApp reminder send failed (all fallbacks)',
              detail: { mode: 'legacy-scan', error: result.error, attempts: result.attempts },
            })
          }
        } else {
          await appendOrderNotificationDiagnostic(writeClient, order._id, {
            source: 'cron/unaccepted-orders-whatsapp',
            level: 'warn',
            message: 'Unaccepted-order WhatsApp reminder skipped: tenant has no ownerPhone',
            detail: { mode: 'legacy-scan' },
          })
        }

        // We mark it as notified even if we failed to send or there is no phone,
        // so we don't keep trying and failing every minute for the next 2 hours.
        await writeClient
          .patch(order._id)
          .set({
            businessWhatsappUnacceptedReminderAt: nowIso,
            businessWhatsappNotifiedAt: nowIso,
          })
          .commit()
      } catch (e) {
        console.error('[cron/unaccepted-orders-whatsapp] Failed processing order', order._id, e)
      }
    }

    return NextResponse.json({ ok: true, notifiedCount })
  } catch (error) {
    console.error('[cron/unaccepted-orders-whatsapp] Error fetching orders:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
