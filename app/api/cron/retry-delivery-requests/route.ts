import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { notifyDriversOfDeliveryOrder } from '@/lib/notify-drivers-for-order'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

const RETRY_INTERVAL_MS = 3 * 60 * 1000 // 3 minutes

type PendingOrder = {
  _id: string
  deliveryRequestedAt?: string
  lastDeliveryRequestPingAt?: string
}

/**
 * GET (invoked by Vercel Cron every 3 minutes) — Re-send delivery request push to
 * online drivers for any order that has been waiting for a driver longer than 3 minutes
 * without being accepted. Once a driver accepts, deliveryRequestedAt is cleared so
 * the order drops out of this query automatically.
 *
 * On acceptance, the business is notified via sendTenantAndStaffPush (this is also
 * handled in /api/driver/orders/[orderId]/accept, this cron only handles the re-ping).
 *
 * Secured by CRON_SECRET.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  // Orders still waiting for a driver (deliveryRequestedAt set, no assignedDriver)
  const cutoffIso = new Date(Date.now() - RETRY_INTERVAL_MS).toISOString()
  const pendingOrders = await writeClient.fetch<PendingOrder[]>(
    `*[
      _type == "order" &&
      defined(deliveryRequestedAt) &&
      !defined(assignedDriver) &&
      status in ["new", "preparing", "waiting_for_delivery"] &&
      (
        !defined(lastDeliveryRequestPingAt) && deliveryRequestedAt <= $cutoff
        || defined(lastDeliveryRequestPingAt) && lastDeliveryRequestPingAt <= $cutoff
      )
    ]{
      _id,
      deliveryRequestedAt,
      lastDeliveryRequestPingAt
    }`,
    { cutoff: cutoffIso }
  )

  if (!pendingOrders?.length) {
    return NextResponse.json({ ok: true, retriedCount: 0 })
  }

  const nowIso = new Date().toISOString()
  let retriedCount = 0

  for (const order of pendingOrders) {
    try {
      // Reuse the centralized fanout logic (online matching + offline reminders).
      await notifyDriversOfDeliveryOrder(order._id)

      // Update ping timestamp so we don't re-send for another 3 minutes
      await writeClient.patch(order._id).set({ lastDeliveryRequestPingAt: nowIso }).commit()
      retriedCount++
    } catch (e) {
      console.error('[cron/retry-delivery-requests] Failed for order', order._id, e)
    }
  }

  return NextResponse.json({ ok: true, retriedCount })
}
