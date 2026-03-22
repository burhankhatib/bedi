import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { appendOrderNotificationDiagnostic } from '@/lib/notification-diagnostics'
import { notifyBusinessWhatsappForOrder } from '@/lib/business-whatsapp-notifier'

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
  const forceLegacyScan = url.searchParams.get('allowLegacy') === '1'

  if (allowed.length && !allowed.includes(bearer) && !(secretParam && allowed.includes(secretParam))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  // Orders still not accepted (status == new): send WhatsApp reminder using the same enhanced
  // `new_order` template (full details + Maps/Waze) as instant notifications.
  // If instant WhatsApp already succeeded (`businessWhatsappInstantNotifiedAt`), do not send again —
  // many businesses rely on a single WhatsApp ping only (no app).
  // Gated by businessWhatsappUnacceptedReminderAt + no prior instant WhatsApp on the order.
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
        tenantId?: string
        tenantName?: string
        tenantNameAr?: string
        tenantSlug?: string
      } | null>(
        `*[
          _type == "order" &&
          _id == $orderId &&
          status == "new" &&
          !defined(businessWhatsappUnacceptedReminderAt)
        ][0]{
          _id,
          "tenantId": site._ref,
          "tenantName": site->name,
          "tenantNameAr": site->name_ar,
          "tenantSlug": site->slug.current
        }`,
        { orderId: singleOrderId }
      )
      if (!order?._id) {
        return NextResponse.json({ ok: true, notifiedCount: 0, skipped: true })
      }
      if (!order.tenantId) {
        await appendOrderNotificationDiagnostic(writeClient, order._id, {
          source: 'cron/unaccepted-orders-whatsapp',
          level: 'warn',
          message: 'Unaccepted-order reminder skipped: order has no site reference',
          detail: { mode: 'single-order' },
        })
        return NextResponse.json({ ok: true, notifiedCount: 0, skipped: true, reason: 'missing-tenant' })
      }
      const notify = await notifyBusinessWhatsappForOrder({
        writeClient,
        orderId: order._id,
        tenantId: order.tenantId,
        tenantSlug: order.tenantSlug,
        tenantName: order.tenantName,
        tenantNameAr: order.tenantNameAr,
        mode: 'unaccepted-reminder',
        skipIfInstantAlreadySent: false,
      })
      if (notify.allFailed) {
        // Return non-2xx so /api/jobs/process-due retries this job.
        return NextResponse.json(
          { ok: false, notifiedCount: 0, orderId: singleOrderId, retryable: true, reason: 'all_recipients_failed' },
          { status: 502 }
        )
      }
      return NextResponse.json({ ok: true, notifiedCount: notify.sent, attempted: notify.attempted, orderId: singleOrderId })
    } catch (error) {
      console.error('[cron/unaccepted-orders-whatsapp] single order failed:', error)
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
  }

  const allowLegacyScan = process.env.ENABLE_LEGACY_SANITY_SCAN_CRONS === 'true'
  if (!allowLegacyScan && !forceLegacyScan) {
    return NextResponse.json({ ok: true, notifiedCount: 0, skipped: true, reason: 'legacy-scan-disabled' })
  }

  try {
    const unacceptedOrders = await writeClient.fetch<{
      _id: string
      tenantId?: string
      tenantName?: string
      tenantNameAr?: string
      tenantSlug?: string
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
        "tenantId": site._ref,
        "tenantName": site->name,
        "tenantNameAr": site->name_ar,
        "tenantSlug": site->slug.current
      }`,
      { cutoff3m, cutoff2h }
    )

    if (!unacceptedOrders?.length) {
      return NextResponse.json({ ok: true, notifiedCount: 0 })
    }

    let notifiedCount = 0
    let failedCount = 0
    for (const order of unacceptedOrders) {
      try {
        if (!order.tenantId) {
          await appendOrderNotificationDiagnostic(writeClient, order._id, {
            source: 'cron/unaccepted-orders-whatsapp',
            level: 'warn',
            message: 'Unaccepted-order reminder skipped: order has no site reference',
            detail: { mode: 'legacy-scan' },
          })
          continue
        }
        const notify = await notifyBusinessWhatsappForOrder({
          writeClient,
          orderId: order._id,
          tenantId: order.tenantId,
          tenantSlug: order.tenantSlug,
          tenantName: order.tenantName,
          tenantNameAr: order.tenantNameAr,
          mode: 'unaccepted-reminder',
          skipIfInstantAlreadySent: false,
        })
        if (notify.sent > 0) {
          notifiedCount++
        } else if (notify.allFailed) {
          failedCount++
        }
      } catch (e) {
        failedCount++
        console.error('[cron/unaccepted-orders-whatsapp] Failed processing order', order._id, e)
      }
    }

    return NextResponse.json({ ok: true, notifiedCount, failedCount })
  } catch (error) {
    console.error('[cron/unaccepted-orders-whatsapp] Error fetching orders:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
