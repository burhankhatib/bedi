import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { GROQ_STATUS_AWAITING_DRIVER } from '@/lib/delivery-awaiting-driver-status'
import { executeDeliveryRequestBroadcast } from '@/lib/execute-delivery-request-broadcast'
import { sendTenantAndStaffPush } from '@/lib/tenant-and-staff-push'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

type DueOrder = {
  _id: string
  orderNumber?: string
  siteId: string
  tenantSlug: string | null
}

/**
 * GET — Vercel Cron (every minute). Fires scheduled auto delivery requests.
 * Secured with CRON_SECRET.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const m = authHeader?.match(/^Bearer\s+(.+)$/i)
  const bearer = m?.[1]?.trim() || ''
  const allowedSecrets = [process.env.CRON_SECRET, process.env.FIREBASE_JOB_SECRET].filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  )
  if (allowedSecrets.length && !allowedSecrets.includes(bearer)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const now = new Date().toISOString()
  const due = await writeClient.fetch<DueOrder[]>(
    `*[
      _type == "order" &&
      orderType == "delivery" &&
      ${GROQ_STATUS_AWAITING_DRIVER} &&
      !defined(assignedDriver) &&
      defined(autoDeliveryRequestScheduledAt) &&
      autoDeliveryRequestScheduledAt <= $now &&
      !defined(autoDeliveryRequestTriggeredAt) &&
      !defined(deliveryRequestedAt)
    ]{
      _id,
      orderNumber,
      "siteId": site._ref,
      "tenantSlug": site->slug.current
    }`,
    { now }
  )

  let processed = 0
  for (const o of due ?? []) {
    try {
      await executeDeliveryRequestBroadcast(o._id)
      processed += 1
      const slug = (o.tenantSlug || '').trim()
      const num = (o.orderNumber || '').trim() || o._id.slice(-6)
      if (o.siteId) {
        await sendTenantAndStaffPush(o.siteId, {
          title: 'Delivery request sent',
          body: `Order #${num} — drivers in your area have been notified.`,
          url: slug ? `/t/${encodeURIComponent(slug)}/orders` : '/',
          dir: 'rtl',
        })
      }
    } catch (e) {
      console.error('[cron auto-delivery-request] order failed', o._id, e)
    }
  }

  return NextResponse.json({ ok: true, processed, checked: (due ?? []).length })
}
