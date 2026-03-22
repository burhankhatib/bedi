import { NextResponse } from 'next/server'
import { getFirestoreAdmin, isFirebaseAdminConfigured } from '@/lib/firebase-admin'
import type { ScheduledJobType } from '@/lib/delivery-job-scheduler'

export const dynamic = 'force-dynamic'

/** Vercel Cron sends Authorization: Bearer $CRON_SECRET; Firebase Functions may use FIREBASE_JOB_SECRET only. Accept either. */
function isAuthorizedJobProcessor(req: Request): boolean {
  const header = req.headers.get('authorization')
  const m = header?.match(/^Bearer\s+(.+)$/i)
  const token = m?.[1]?.trim() || ''
  
  const url = new URL(req.url)
  const secretParam = url.searchParams.get('secret')
  
  const secrets = [process.env.CRON_SECRET, process.env.FIREBASE_JOB_SECRET].filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  )
  
  if (!secrets.length) return true
  return secrets.includes(token) || (secretParam != null && secrets.includes(secretParam))
}

type JobDoc = {
  type?: ScheduledJobType
  orderId?: string
  runAtMs?: number
  status?: string
  attempts?: number
}

/** Matches `lib/firebase-admin` FirestoreLike query snapshot (avoid fragile `ReturnType` chains). */
type ScheduledJobsSnapshot = {
  docs: Array<{
    id: string
    ref: { update: (d: Record<string, unknown>) => Promise<unknown> }
    data: () => Record<string, unknown>
  }>
}

function getBaseUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (env) return env.replace(/\/$/, '')
  const url = new URL(req.url)
  return `${url.protocol}//${url.host}`
}

async function runLegacyFallbackCrons(req: Request): Promise<{
  unacceptedOrders: unknown
  scheduledReminders: unknown
  deliveryTierEscalation: unknown
  retryDeliveryRequests: unknown
  unacceptedDeliveryWhatsapp: unknown
}> {
  const baseUrl = getBaseUrl(req)
  const secret = process.env.CRON_SECRET || process.env.FIREBASE_JOB_SECRET || ''
  const headers: HeadersInit = secret ? { Authorization: `Bearer ${secret}` } : {}

  const call = async (url: string): Promise<unknown> => {
    const res = await fetch(url, { headers, method: 'GET', cache: 'no-store' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, status: res.status, body }
    }
    return body
  }

  const [unacceptedOrders, scheduledReminders, deliveryTierEscalation, retryDeliveryRequests, unacceptedDeliveryWhatsapp] = await Promise.all([
    call(`${baseUrl}/api/cron/unaccepted-orders-whatsapp?allowLegacy=1`),
    call(`${baseUrl}/api/cron/scheduled-order-reminders?allowLegacy=1`),
    call(`${baseUrl}/api/cron/delivery-tier-escalation?allowLegacy=1`),
    call(`${baseUrl}/api/cron/retry-delivery-requests?allowLegacy=1`),
    call(`${baseUrl}/api/cron/unaccepted-delivery-whatsapp?allowLegacy=1`),
  ])

  return { unacceptedOrders, scheduledReminders, deliveryTierEscalation, retryDeliveryRequests, unacceptedDeliveryWhatsapp }
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

/** Wrap a promise with a hard timeout; resolves to null on timeout rather than throwing. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

async function runProcessDue(req: Request): Promise<NextResponse> {
  if (!isAuthorizedJobProcessor(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Always kick off the legacy fallback scan immediately (in parallel with any Firestore work).
  // This guarantees the batch scan runs even when Firestore is disabled/unreachable.
  const fallbackPromise = runLegacyFallbackCrons(req)

  if (!isFirebaseAdminConfigured()) {
    const fallback = await fallbackPromise
    return NextResponse.json({ ok: true, processed: 0, reason: 'firebase-admin-not-configured', fallback })
  }
  const db = getFirestoreAdmin()
  if (!db) {
    const fallback = await fallbackPromise
    return NextResponse.json({ ok: true, processed: 0, reason: 'firestore-unavailable', fallback })
  }

  const nowMs = Date.now()
  let pending: ScheduledJobsSnapshot | null = null
  let firestoreFailed = false
  try {
    // 5-second timeout: Firestore PERMISSION_DENIED can hang if the project is misconfigured.
    // Failing fast ensures the legacy fallback (already running) completes within the function budget.
    pending = await withTimeout(
      db.collection('scheduledJobs').where('status', '==', 'pending').limit(200).get() as Promise<ScheduledJobsSnapshot>,
      5000
    )
    if (!pending) {
      firestoreFailed = true
      console.warn('[process-due] Firestore query timed out (5s) — Firestore API may be disabled')
    }
  } catch (error) {
    firestoreFailed = true
    console.error('[process-due] Firestore query failed:', error)
  }

  let processed = 0
  let failed = 0

  if (!firestoreFailed && pending) {
    const dueDocs = pending.docs.filter((d) => {
      const runAtMs = Number((d.data() as JobDoc).runAtMs ?? 0)
      return Number.isFinite(runAtMs) && runAtMs <= nowMs
    }).slice(0, 50)

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
  }

  const fallback = await fallbackPromise

  return NextResponse.json({ 
    ok: true, 
    processed, 
    failed, 
    firestoreFailed,
    fallback 
  })
}

/** POST — Firebase scheduled function (`processDueJobs`) */
export async function POST(req: Request) {
  return runProcessDue(req)
}

/** GET — Vercel Cron only invokes GET; same auth and behavior as POST */
export async function GET(req: Request) {
  return runProcessDue(req)
}

