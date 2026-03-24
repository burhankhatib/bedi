import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { NotificationService } from '@/lib/notifications/NotificationService'
import { scheduleOrderUnacceptedWhatsapp } from '@/lib/delivery-job-scheduler'
import { recordOrderUnacceptedWhatsappJobResult } from '@/lib/notification-diagnostics'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Validate cron secret if provided in environment
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET) {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }

    if (!token) {
      console.error('Missing API token for cron job')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const writeClient = client.withConfig({ token, useCdn: false })
    const now = new Date().toISOString()
    const url = new URL(request.url)
    const singleOrderId = url.searchParams.get('orderId')?.trim()
    const forceLegacyScan = url.searchParams.get('allowLegacy') === '1'

    if (singleOrderId) {
      const order = await writeClient.fetch<{
        _id: string
        orderNumber: string
        tenantId: string
        tenantPhone?: string
        tenantName?: string
        tenantNameAr?: string
        tenantSlug: string
        prioritizeWhatsapp?: boolean
      } | null>(
        `*[_type == "order" && _id == $orderId && status == "acknowledged" && defined(notifyAt) && notifyAt <= $now && reminderSent != true][0]{
          _id,
          orderNumber,
          "tenantId": site._ref,
          "tenantPhone": site->ownerPhone,
          "tenantName": site->name,
          "tenantNameAr": site->name_ar,
          "tenantSlug": site->slug.current,
          "prioritizeWhatsapp": site->prioritizeWhatsapp
        }`,
        { orderId: singleOrderId, now }
      )
      if (!order?._id) {
        return NextResponse.json({ success: true, processed: 0, skipped: true })
      }
      await writeClient
        .patch(order._id)
        .set({ reminderSent: true, status: 'new' })
        .unset([
          'businessWhatsappNotifiedAt',
          'businessWhatsappUnacceptedReminderAt',
          'businessWhatsappInstantNotifiedAt',
        ])
        .commit()
      try {
        await NotificationService.onNewOrder({
          orderId: order._id,
          orderNumber: order.orderNumber,
          tenantId: order.tenantId,
          tenantSlug: order.tenantSlug,
          tenantName: order.tenantName,
          tenantNameAr: order.tenantNameAr,
          tenantPhone: order.tenantPhone,
          prioritizeWhatsapp: order.prioritizeWhatsapp,
        })
      } finally {
        const jobRes = await scheduleOrderUnacceptedWhatsapp(order._id, Date.now())
        await recordOrderUnacceptedWhatsappJobResult(
          writeClient,
          order._id,
          'cron/scheduled-order-reminders (single)',
          jobRes
        )
      }
      return NextResponse.json({ success: true, processed: 1, orderId: singleOrderId })
    }

    const allowLegacyScan = process.env.ENABLE_LEGACY_SANITY_SCAN_CRONS === 'true'
    if (!allowLegacyScan && !forceLegacyScan) {
      return NextResponse.json({ success: true, processed: 0, skipped: true, reason: 'legacy-scan-disabled' })
    }

    // Find orders that are acknowledged, have a notifyAt time that is now or in the past, and haven't had a reminder sent
    const query = `*[_type == "order" && status == "acknowledged" && defined(notifyAt) && notifyAt <= $now && reminderSent != true]{
      _id,
      orderNumber,
      "tenantId": site._ref,
      "tenantPhone": site->ownerPhone,
      "tenantName": site->name,
      "tenantNameAr": site->name_ar,
      "tenantSlug": site->slug.current,
      "prioritizeWhatsapp": site->prioritizeWhatsapp
    }`
    
    const ordersToRemind = await writeClient.fetch<{ 
      _id: string; 
      orderNumber: string; 
      tenantId: string;
      tenantPhone?: string;
      tenantName?: string;
      tenantNameAr?: string;
      tenantSlug: string;
      prioritizeWhatsapp?: boolean;
    }[]>(
      query,
      { now }
    )

    console.log(`[cron/scheduled-order-reminders] Found ${ordersToRemind.length} orders to remind.`)

    const results = []

    for (const order of ordersToRemind) {
      try {
        // Mark the reminder as sent, change status back to new so it pops up in dashboard,
        // and explicitly unset the WhatsApp notified flag so the backup cron can pick it up.
        await writeClient
          .patch(order._id)
          .set({ reminderSent: true, status: 'new' })
          .unset([
            'businessWhatsappNotifiedAt',
            'businessWhatsappUnacceptedReminderAt',
            'businessWhatsappInstantNotifiedAt',
          ])
          .commit()

        // Trigger immediate ring/push; always queue delayed WhatsApp backup even if push fails.
        try {
          await NotificationService.onNewOrder({
            orderId: order._id,
            orderNumber: order.orderNumber,
            tenantId: order.tenantId,
            tenantSlug: order.tenantSlug,
            tenantName: order.tenantName,
            tenantNameAr: order.tenantNameAr,
            tenantPhone: order.tenantPhone,
            prioritizeWhatsapp: order.prioritizeWhatsapp
          })
        } finally {
          const jobRes = await scheduleOrderUnacceptedWhatsapp(order._id, Date.now())
          await recordOrderUnacceptedWhatsappJobResult(
            writeClient,
            order._id,
            'cron/scheduled-order-reminders (batch)',
            jobRes
          )
        }

        results.push({ orderId: order._id, success: true })
      } catch (err) {
        console.error(`[cron/scheduled-order-reminders] Failed to process order ${order._id}:`, err)
        results.push({ orderId: order._id, success: false, error: String(err) })
      }
    }

    return NextResponse.json({
      success: true,
      processed: ordersToRemind.length,
      results,
    })

  } catch (error) {
    console.error('[cron/scheduled-order-reminders] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
