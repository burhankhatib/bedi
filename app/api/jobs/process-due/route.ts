import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { getFirestoreAdmin, isFirebaseAdminConfigured } from '@/lib/firebase-admin'
import type { ScheduledJobType } from '@/lib/delivery-job-scheduler'
import { sendWhatsAppTemplateMessageWithLangFallback } from '@/lib/meta-whatsapp'
import { WHATSAPP_TEMPLATE } from '@/lib/whatsapp-meta-templates'

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
    ref: { 
      id: string
      update: (d: Record<string, unknown>) => Promise<unknown>
      set: (d: Record<string, unknown>, opts?: { merge?: boolean }) => Promise<unknown>
      get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>
    }
    data: () => Record<string, unknown>
  }>
}

function getBaseUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (env) return env.replace(/\/$/, '')
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, '')
    return `https://${host}`
  }
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

/** Sanity GROQ backup for 3‑min business WhatsApp (same as pre‑Firestore cron). Idempotent via order fields. */
async function runUnacceptedOrdersWhatsappLegacy(req: Request): Promise<unknown> {
  const baseUrl = getBaseUrl(req)
  const secret = process.env.CRON_SECRET || process.env.FIREBASE_JOB_SECRET || ''
  const headers: HeadersInit = secret ? { Authorization: `Bearer ${secret}` } : {}
  const res = await fetch(`${baseUrl}/api/cron/unaccepted-orders-whatsapp?allowLegacy=1`, {
    headers,
    method: 'GET',
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, status: res.status, body }
  return body
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

  // Kick off the legacy fallback scan if Firestore is unavailable OR explicitly forced.
  // Note: if Firebase IS configured but Firestore later times out, we run the fallback
  // afterwards (see end of function) to ensure the 3-minute reminder still fires.
  const isFallbackNeeded = !isFirebaseAdminConfigured() || req.url.includes('allowLegacy=1')
  const fallbackPromise = isFallbackNeeded 
    ? runLegacyFallbackCrons(req) 
    : Promise.resolve({ skipped: true })

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
  let usedLegacyPendingScan = false

  /**
   * IMPORTANT: `where(status==pending).limit(200)` without orderBy returns an *arbitrary* 200 docs.
   * With many future-dated jobs (delivery tiers, retries), due jobs like `order_unaccepted_whatsapp`
   * may never appear — breaking the 3‑minute reminder. Query due work only: status + runAtMs <= now,
   * ordered by runAtMs (requires composite index in firestore.indexes.json).
   */
  const fetchDueScheduledJobs = async (): Promise<ScheduledJobsSnapshot | null> => {
    const col = db as unknown as {
      collection: (name: string) => {
        where: (f: string, o: string, v: unknown) => {
          where: (f2: string, o2: string, v2: unknown) => {
            orderBy: (field: string, dir?: string) => { limit: (n: number) => { get: () => Promise<ScheduledJobsSnapshot> } }
          }
        }
      }
    }
    try {
      return await col
        .collection('scheduledJobs')
        .where('status', '==', 'pending')
        .where('runAtMs', '<=', nowMs)
        .orderBy('runAtMs', 'asc')
        .limit(50)
        .get()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const needsIndex =
        msg.includes('FAILED_PRECONDITION') ||
        msg.includes('index') ||
        msg.includes('requires an index')
      if (!needsIndex) throw e
      console.warn(
        '[process-due] Due-job query failed (deploy firestore.indexes.json scheduledJobs index). Falling back to unordered pending scan:',
        msg
      )
      usedLegacyPendingScan = true
      return (await db
        .collection('scheduledJobs')
        .where('status', '==', 'pending')
        .limit(200)
        .get()) as unknown as ScheduledJobsSnapshot
    }
  }

  try {
    pending = await withTimeout(fetchDueScheduledJobs(), 8000)
    if (!pending) {
      firestoreFailed = true
      console.warn('[process-due] Firestore query timed out — Firestore API may be slow or disabled')
    }
  } catch (error) {
    firestoreFailed = true
    console.error('[process-due] Firestore query failed:', error)
  }

  let processed = 0
  let failed = 0

  if (!firestoreFailed && pending) {
    const dueDocs = usedLegacyPendingScan
      ? pending.docs
          .filter((d) => {
            const runAtMs = Number((d.data() as JobDoc).runAtMs ?? 0)
            return Number.isFinite(runAtMs) && runAtMs <= nowMs
          })
          .slice(0, 50)
      : pending.docs

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

  // Handle broadcast jobs in a small chunk
  let broadcastProcessed = 0
  if (!firestoreFailed) {
    try {
      const broadcastSnap = await db.collection('broadcastJobs').where('status', '==', 'pending').limit(2).get()
      if (!broadcastSnap.empty) {
        for (const doc of broadcastSnap.docs) {
          const data = doc.data()
          if (!data || data.status !== 'pending') continue
          
          await doc.ref.update({ status: 'processing', updatedAtMs: Date.now() })
          const recipients = Array.isArray(data.recipients) ? data.recipients : []
          const cursor = typeof data.cursor === 'number' && Number.isFinite(data.cursor) ? data.cursor : 0
          const message = typeof data.message === 'string' ? data.message : ''
          const chunk = recipients.slice(cursor, cursor + 20) as Array<{ name: string; phone: string }>
          
          let newSent = 0
          let newFailed = 0
          const newSuccessList: string[] = []
          const newFailedList: string[] = []
          const newErrorsList: any[] = []

          for (const u of chunk) {
            const firstName = u.name.split(' ')[0] || 'User'
            const result = await sendWhatsAppTemplateMessageWithLangFallback(
              u.phone,
              WHATSAPP_TEMPLATE.BROADCAST,
              [firstName, message]
            )
            if (result.success) {
              newSent++
              newSuccessList.push(`${u.name} (${u.phone})`)
            } else {
              newFailed++
              newFailedList.push(`${u.name} (${u.phone})`)
              newErrorsList.push({ phone: u.phone, error: result.error })
            }
          }

          const nextCursor = cursor + chunk.length
          const totalFound = recipients.length
          const isDone = nextCursor >= totalFound

          // Atomically update progress
          const updatedDoc = await db.runTransaction(async (t) => {
            const freshDoc = await t.get(doc.ref)
            const freshData = freshDoc.data()
            if (!freshData) return null
            
            const updatedSent = (typeof freshData.sentCount === 'number' ? freshData.sentCount : 0) + newSent
            const updatedFailed = (typeof freshData.failedCount === 'number' ? freshData.failedCount : 0) + newFailed
            const prevSuccess = Array.isArray(freshData.successfulNumbers) ? freshData.successfulNumbers : []
            const prevFailed = Array.isArray(freshData.failedNumbers) ? freshData.failedNumbers : []
            const prevErrors = Array.isArray(freshData.errorsList) ? freshData.errorsList : []
            const updatedSuccessList = [...prevSuccess, ...newSuccessList]
            const updatedFailedList = [...prevFailed, ...newFailedList]
            const updatedErrorsList = [...prevErrors, ...newErrorsList]

            const updates = {
              status: isDone ? 'done' : 'pending',
              cursor: nextCursor,
              sentCount: updatedSent,
              failedCount: updatedFailed,
              successfulNumbers: updatedSuccessList,
              failedNumbers: updatedFailedList,
              errorsList: updatedErrorsList,
              updatedAtMs: Date.now(),
            }
            t.update(doc.ref, updates)
            return { ...freshData, ...updates } as Record<string, unknown>
          })
          
          broadcastProcessed += chunk.length

          // If done, persist history in Firestore (avoids Sanity API on each broadcast)
          if (isDone && updatedDoc) {
            try {
              const historyId = randomUUID()
              const recipients = updatedDoc.recipients
              const errorsList = updatedDoc.errorsList
              await db.collection('broadcastHistory').doc(historyId).set({
                message: typeof updatedDoc.message === 'string' ? updatedDoc.message : '',
                targets: Array.isArray(updatedDoc.targets) ? updatedDoc.targets : [],
                countries: typeof updatedDoc.countries === 'string' ? updatedDoc.countries : '',
                cities: typeof updatedDoc.cities === 'string' ? updatedDoc.cities : '',
                specificNumbers: typeof updatedDoc.specificNumbers === 'string' ? updatedDoc.specificNumbers : '',
                successfulNumbers: Array.isArray(updatedDoc.successfulNumbers) ? updatedDoc.successfulNumbers : [],
                failedNumbers: Array.isArray(updatedDoc.failedNumbers) ? updatedDoc.failedNumbers : [],
                sentCount: typeof updatedDoc.sentCount === 'number' ? updatedDoc.sentCount : 0,
                failedCount: typeof updatedDoc.failedCount === 'number' ? updatedDoc.failedCount : 0,
                totalFound: Array.isArray(recipients) ? recipients.length : 0,
                errors:
                  Array.isArray(errorsList) && errorsList.length > 0
                    ? JSON.stringify(errorsList, null, 2)
                    : '',
                createdAtMs: Date.now(),
              })
            } catch (err) {
              console.error('[process-due] Failed to write broadcastHistory to Firestore', err)
            }
          }
        }
      }
    } catch (err) {
      console.error('[process-due] Broadcast job scan failed:', err)
    }
  }

  // If Firestore failed but Firebase was configured (fallbackPromise was skipped above),
  // run the legacy scan now so the 3-minute reminder can still fire via Sanity polling.
  let fallback: unknown
  if (firestoreFailed && !isFallbackNeeded) {
    console.warn('[process-due] Firestore failed — running legacy fallback scan as safety net')
    fallback = await runLegacyFallbackCrons(req)
  } else {
    fallback = await fallbackPromise
  }

  // When Firestore is healthy we skip parallel `runLegacyFallbackCrons` (see isFallbackNeeded).
  // Still run the Sanity GROQ scan for unaccepted orders here: it matches pre‑Firestore behavior and
  // catches jobs the Firestore query missed (e.g. before composite index deploy). Deduped on the order doc.
  let sanityUnacceptedWhatsappScan: unknown = { skipped: true }
  if (!isFallbackNeeded && !firestoreFailed) {
    try {
      sanityUnacceptedWhatsappScan = await runUnacceptedOrdersWhatsappLegacy(req)
    } catch (e) {
      sanityUnacceptedWhatsappScan = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  return NextResponse.json({ 
    ok: true, 
    processed, 
    failed, 
    broadcastProcessed,
    firestoreFailed,
    usedLegacyPendingScan,
    fallback,
    sanityUnacceptedWhatsappScan,
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

