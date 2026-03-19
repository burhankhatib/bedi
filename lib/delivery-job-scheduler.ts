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

export async function scheduleJob(input: ScheduleJobInput): Promise<void> {
  if (!isFirebaseAdminConfigured()) return
  const db = getFirestoreAdmin()
  if (!db) return
  const id = jobId(input.type, input.orderId)
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
}

export async function scheduleDeliveryLifecycleJobs(orderId: string, requestedAtMs = Date.now()): Promise<void> {
  await Promise.all([
    scheduleJob({ type: 'delivery_tier_2', orderId, runAtMs: requestedAtMs + 60_000 }),
    scheduleJob({ type: 'delivery_tier_3', orderId, runAtMs: requestedAtMs + 120_000 }),
    scheduleJob({ type: 'delivery_retry_ping', orderId, runAtMs: requestedAtMs + 180_000 }),
    scheduleJob({ type: 'delivery_whatsapp_retry', orderId, runAtMs: requestedAtMs + 180_000 }),
  ])
}

export async function scheduleOrderUnacceptedWhatsapp(orderId: string, createdAtMs = Date.now()): Promise<void> {
  await scheduleJob({ type: 'order_unaccepted_whatsapp', orderId, runAtMs: createdAtMs + 180_000 })
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
  const snapshot = await db
    .collection('scheduledJobs')
    .where('orderId', '==', orderId)
    .where('status', '==', 'pending')
    .get()

  if (!snapshot.docs.length) return
  await Promise.all(
    snapshot.docs.map((doc) =>
      doc.ref.update({
        status: 'cancelled',
        updatedAtMs: Date.now(),
      })
    )
  )
}

