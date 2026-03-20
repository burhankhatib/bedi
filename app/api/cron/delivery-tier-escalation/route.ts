import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { GROQ_STATUS_AWAITING_DRIVER } from '@/lib/delivery-awaiting-driver-status'
import { notifyDriversEscalationTier } from '@/lib/notify-drivers-for-order'

export const dynamic = 'force-dynamic'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  // Try to read secret from URL parameter as a fallback (for cron-job.org testing)
  const url = new URL(req.url)
  const secretParam = url.searchParams.get('secret')
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && secretParam !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const orderIdParam = url.searchParams.get('orderId')?.trim()
  const tierParam = Number(url.searchParams.get('tier') || '')
  if (orderIdParam && (tierParam === 2 || tierParam === 3)) {
    const order = await writeClient.fetch<{ _id: string } | null>(
      `*[
        _type == "order" &&
        _id == $orderId &&
        defined(deliveryRequestedAt) &&
        !defined(assignedDriver) &&
        ${GROQ_STATUS_AWAITING_DRIVER}
      ][0]{ _id }`,
      { orderId: orderIdParam }
    )
    if (!order?._id) {
      return NextResponse.json({ ok: true, tier2Count: 0, tier3Count: 0, skipped: true })
    }
    if (tierParam === 2) {
      await notifyDriversEscalationTier(orderIdParam, 2)
      await writeClient.patch(orderIdParam).set({ deliveryTier2SentAt: new Date().toISOString() }).commit()
      return NextResponse.json({ ok: true, tier2Count: 1, tier3Count: 0, orderId: orderIdParam })
    }
    await notifyDriversEscalationTier(orderIdParam, 3)
    await writeClient.patch(orderIdParam).set({ deliveryTier3SentAt: new Date().toISOString() }).commit()
    return NextResponse.json({ ok: true, tier2Count: 0, tier3Count: 1, orderId: orderIdParam })
  }

  const allowLegacyScan = process.env.ENABLE_LEGACY_SANITY_SCAN_CRONS === 'true'
  if (!allowLegacyScan) {
    return NextResponse.json({ ok: true, tier2Count: 0, tier3Count: 0, skipped: true, reason: 'legacy-scan-disabled' })
  }

  const nowMs = Date.now()
  const cutoff60s = new Date(nowMs - 60_000).toISOString()
  
  let tier2Count = 0
  let tier3Count = 0

  try {
    // ─────────────────────────────────────────────────────────────────────────────
    // RUN TIER 2 (1-2km): Orders where Tier 1 was sent >60s ago, and no Tier 2 sent
    // ─────────────────────────────────────────────────────────────────────────────
    const pendingTier2 = await writeClient.fetch<{ _id: string }[]>(
      `*[
        _type == "order" &&
        defined(deliveryRequestedAt) &&
        !defined(assignedDriver) &&
        ${GROQ_STATUS_AWAITING_DRIVER} &&
        defined(deliveryTier1SentAt) &&
        deliveryTier1SentAt <= $cutoff60s &&
        !defined(deliveryTier2SentAt)
      ]{ _id }`,
      { cutoff60s }
    )

    if (pendingTier2?.length) {
      for (const order of pendingTier2) {
        try {
          await notifyDriversEscalationTier(order._id, 2)
          await writeClient.patch(order._id).set({ deliveryTier2SentAt: new Date().toISOString() }).commit()
          tier2Count++
        } catch (e) {
          console.error(`[cron/tier-escalation] Failed Tier 2 for order ${order._id}`, e)
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // RUN TIER 3 (>2km): Orders where Tier 2 was sent >60s ago, and no Tier 3 sent
    // ─────────────────────────────────────────────────────────────────────────────
    const pendingTier3 = await writeClient.fetch<{ _id: string }[]>(
      `*[
        _type == "order" &&
        defined(deliveryRequestedAt) &&
        !defined(assignedDriver) &&
        ${GROQ_STATUS_AWAITING_DRIVER} &&
        defined(deliveryTier2SentAt) &&
        deliveryTier2SentAt <= $cutoff60s &&
        !defined(deliveryTier3SentAt)
      ]{ _id }`,
      { cutoff60s }
    )

    if (pendingTier3?.length) {
      for (const order of pendingTier3) {
        try {
          await notifyDriversEscalationTier(order._id, 3)
          await writeClient.patch(order._id).set({ deliveryTier3SentAt: new Date().toISOString() }).commit()
          tier3Count++
        } catch (e) {
          console.error(`[cron/tier-escalation] Failed Tier 3 for order ${order._id}`, e)
        }
      }
    }

    return NextResponse.json({ ok: true, tier2Count, tier3Count })
  } catch (error) {
    console.error('[cron/tier-escalation] Fetch failed:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
