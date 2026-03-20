import { getFirestoreAdmin, isFirebaseAdminConfigured } from '@/lib/firebase-admin'

export type ScheduledJobType =
  | 'delivery_tier_2'
  | 'delivery_tier_3'
  | 'delivery_retry_ping'
  | 'delivery_whatsapp_retry'
  | 'order_unaccepted_whatsapp'
  | 'scheduled_order_reminder'

type ScheduleJobInput = {
  type: ScheduledJobType
  orderId: string
  runAtMs: number
  payload?: Record<string, unknown>
}

function jobId(type: ScheduledJobType, orderId: string): string {
  return `${type}:${orderId}`
}

export type ScheduleJobResult =
  | { ok: true; jobDocId: string }
  | {
      ok: false
      reason: 'firebase_admin_not_configured' | 'firestore_unavailable' | 'write_failed'
      message?: string
    }

export async function scheduleJob(input: ScheduleJobInput): Promise<ScheduleJobResult> {
  if (!isFirebaseAdminConfigured()) {
    console.warn(
      '[delivery-job-scheduler] Firebase Admin / Firestore not configured; job not queued:',
      input.type,
      input.orderId,
      '(set FIREBASE_* env or service account — 3min WhatsApp and delivery timers need this + /api/jobs/process-due cron)'
    )
    return { ok: false, reason: 'firebase_admin_not_configured' }
  }
  const db = getFirestoreAdmin()
  if (!db) return { ok: false, reason: 'firestore_unavailable' }
  const id = jobId(input.type, input.orderId)
  try {
    await db.collection('scheduledJobs').doc(id).set(
      {
        type: input.type,
        orderId: input.orderId,
        runAtMs: input.runAtMs,
        payload: input.payload ?? {},
        status: 'pending',
        attempts: 0,
        updatedAtMs: Date.now(),
      },
      { merge: true }
    )
    return { ok: true, jobDocId: id }
  } catch (err) {
    // Never fail order flows (Firestore index/network/etc.)
    console.warn('[delivery-job-scheduler] scheduleJob failed', input.type, input.orderId, err)
    return {
      ok: false,
      reason: 'write_failed',
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function scheduleDeliveryLifecycleJobs(orderId: string, requestedAtMs = Date.now()): Promise<void> {
  await Promise.all([
    scheduleJob({ type: 'delivery_tier_2', orderId, runAtMs: requestedAtMs + 60_000 }),
    scheduleJob({ type: 'delivery_tier_3', orderId, runAtMs: requestedAtMs + 120_000 }),
    scheduleJob({ type: 'delivery_retry_ping', orderId, runAtMs: requestedAtMs + 180_000 }),
    scheduleJob({ type: 'delivery_whatsapp_retry', orderId, runAtMs: requestedAtMs + 180_000 }),
  ])
}

export async function scheduleOrderUnacceptedWhatsapp(
  orderId: string,
  createdAtMs = Date.now()
): Promise<ScheduleJobResult> {
  return scheduleJob({ type: 'order_unaccepted_whatsapp', orderId, runAtMs: createdAtMs + 180_000 })
}

export async function scheduleScheduledOrderReminder(orderId: string, notifyAtIso: string): Promise<void> {
  const ms = new Date(notifyAtIso).getTime()
  if (!Number.isFinite(ms)) return
  await scheduleJob({ type: 'scheduled_order_reminder', orderId, runAtMs: ms })
}

export async function cancelOrderJobs(orderId: string): Promise<void> {
  if (!isFirebaseAdminConfigured()) return
  const db = getFirestoreAdmin()
  if (!db) return
  try {
    // Avoid compound queries: they require a Firestore composite index and throw
    // FAILED_PRECONDITION if missing — which would break order status updates (500).
    const snapshot = await db.collection('scheduledJobs').where('orderId', '==', orderId).get()

    const pending = snapshot.docs.filter((doc) => (doc.data()?.status as string | undefined) === 'pending')
    if (!pending.length) return

    await Promise.all(
      pending.map((doc) =>
        doc.ref.update({
          status: 'cancelled',
          updatedAtMs: Date.now(),
        })
      )
    )
  } catch (err) {
    console.warn('[delivery-job-scheduler] cancelOrderJobs failed — order status should still proceed', orderId, err)
  }
}

