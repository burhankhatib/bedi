import { NextResponse } from 'next/server'
import { getFirestoreAdmin, isFirebaseAdminConfigured } from '@/lib/firebase-admin'
import type { ScheduledJobType } from '@/lib/delivery-job-scheduler'

export const dynamic = 'force-dynamic'

type JobDoc = {
  type?: ScheduledJobType
  orderId?: string
  runAtMs?: number
  status?: string
  attempts?: number
}

function getBaseUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (env) return env.replace(/\/$/, '')
  const url = new URL(req.url)
  return `${url.protocol}//${url.host}`
}

async function executeJob(req: Request, type: ScheduledJobType, orderId: string): Promise<void> {
  const baseUrl = getBaseUrl(req)
  const secret = process.env.CRON_SECRET || process.env.FIREBASE_JOB_SECRET || ''
  const headers: HeadersInit = secret ? { Authorization: `Bearer ${secret}` } : {}

  let url = ''
  if (type === 'delivery_tier_2') {
    url = `${baseUrl}/api/cron/delivery-tier-escalation?orderId=${encodeURIComponent(orderId)}&tier=2`
  } else if (type === 'delivery_tier_3') {
    url = `${baseUrl}/api/cron/delivery-tier-escalation?orderId=${encodeURIComponent(orderId)}&tier=3`
  } else if (type === 'delivery_retry_ping') {
    url = `${baseUrl}/api/cron/retry-delivery-requests?orderId=${encodeURIComponent(orderId)}`
  } else if (type === 'delivery_whatsapp_retry') {
    url = `${baseUrl}/api/cron/unaccepted-delivery-whatsapp?orderId=${encodeURIComponent(orderId)}`
  } else if (type === 'order_unaccepted_whatsapp') {
    url = `${baseUrl}/api/cron/unaccepted-orders-whatsapp?orderId=${encodeURIComponent(orderId)}`
  } else if (type === 'scheduled_order_reminder') {
    url = `${baseUrl}/api/cron/scheduled-order-reminders?orderId=${encodeURIComponent(orderId)}`
  } else {
    throw new Error(`Unknown job type: ${type}`)
  }

  const res = await fetch(url, { headers, method: 'GET', cache: 'no-store' })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Job endpoint failed (${res.status}): ${txt}`)
  }
}

export async function POST(req: Request) {
  const secret = process.env.FIREBASE_JOB_SECRET || process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: true, processed: 0, reason: 'firebase-admin-not-configured' })
  }
  const db = getFirestoreAdmin()
  if (!db) {
    return NextResponse.json({ ok: false, error: 'firestore-unavailable' }, { status: 500 })
  }

  const nowMs = Date.now()
  const pending = await db
    .collection('scheduledJobs')
    .where('status', '==', 'pending')
    .limit(200)
    .get()

  const dueDocs = pending.docs.filter((d) => {
    const runAtMs = Number((d.data() as JobDoc).runAtMs ?? 0)
    return Number.isFinite(runAtMs) && runAtMs <= nowMs
  }).slice(0, 50)

  if (!dueDocs.length) return NextResponse.json({ ok: true, processed: 0 })

  let processed = 0
  let failed = 0

  for (const doc of dueDocs) {
    const data = doc.data() as JobDoc
    const type = data.type
    const orderId = data.orderId
    if (!type || !orderId) {
      await doc.ref.update({ status: 'failed', updatedAtMs: Date.now(), error: 'missing-type-or-orderId' })
      failed++
      continue
    }

    try {
      await doc.ref.update({ status: 'processing', updatedAtMs: Date.now() })
      await executeJob(req, type, orderId)
      await doc.ref.update({ status: 'done', doneAtMs: Date.now(), updatedAtMs: Date.now() })
      processed++
    } catch (error) {
      const attempts = Number(data.attempts ?? 0) + 1
      const retryAtMs = Date.now() + Math.min(5, attempts) * 60_000
      await doc.ref.update({
        status: 'pending',
        attempts,
        runAtMs: retryAtMs,
        lastError: error instanceof Error ? error.message : String(error),
        updatedAtMs: Date.now(),
      })
      failed++
    }
  }

  return NextResponse.json({ ok: true, processed, failed })
}

