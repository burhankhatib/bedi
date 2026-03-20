/**
 * Append-only diagnostics for order notification pipeline (push, WhatsApp, job queue).
 * Stored on the order document for super-admin debugging in Sanity + `/api/admin/orders/.../notifications-debug`.
 */

import { randomBytes } from 'crypto'
import type { SanityClient } from '@sanity/client'

export type NotificationDiagnosticLevel = 'info' | 'warn' | 'error'

export type NotificationDiagnosticAppend = {
  source: string
  level: NotificationDiagnosticLevel
  message: string
  detail?: unknown
}

const MAX_ENTRIES = 40
const MAX_MESSAGE = 500
const MAX_DETAIL_CHARS = 6000

function truncateDetail(detail: unknown): string | undefined {
  if (detail == null) return undefined
  try {
    const s = JSON.stringify(detail)
    if (!s) return undefined
    return s.length > MAX_DETAIL_CHARS ? `${s.slice(0, MAX_DETAIL_CHARS)}…` : s
  } catch {
    return String(detail).slice(0, MAX_DETAIL_CHARS)
  }
}

/**
 * Appends one diagnostic row to `order.notificationDiagnostics` (capped).
 * Never throws to callers — failures are logged only.
 */
export async function appendOrderNotificationDiagnostic(
  writeClient: SanityClient,
  orderId: string,
  entry: NotificationDiagnosticAppend
): Promise<void> {
  if (!orderId?.trim()) return
  const now = new Date().toISOString()
  try {
    const current = await writeClient.fetch<{ notificationDiagnostics?: NotificationDiagnosticRow[] } | null>(
      `*[_type == "order" && _id == $id][0]{ notificationDiagnostics }`,
      { id: orderId }
    )
    const prev = Array.isArray(current?.notificationDiagnostics) ? current!.notificationDiagnostics! : []
    const _key = randomBytes(8).toString('hex')
    const row: NotificationDiagnosticRow = {
      _key,
      at: now,
      source: String(entry.source || 'unknown').slice(0, 120),
      level: entry.level,
      message: String(entry.message || '').slice(0, MAX_MESSAGE),
      detail: truncateDetail(entry.detail),
    }
    const next = [...prev.slice(-(MAX_ENTRIES - 1)), row]
    await writeClient.patch(orderId).set({ notificationDiagnostics: next }).commit()
  } catch (e) {
    console.warn('[notification-diagnostics] append failed for order', orderId, e)
  }
}

type NotificationDiagnosticRow = {
  _key: string
  _type?: string
  at?: string
  source?: string
  level?: string
  message?: string
  detail?: string
}

/** Result shape matches `ScheduleJobResult` from delivery-job-scheduler (avoid circular imports). */
export type UnacceptedWhatsappQueueResult =
  | { ok: true; jobDocId: string }
  | { ok: false; reason: string; message?: string }

/**
 * Logs whether the Firestore backup job for `/api/cron/unaccepted-orders-whatsapp` was queued.
 */
export async function recordOrderUnacceptedWhatsappJobResult(
  writeClient: SanityClient,
  orderId: string,
  source: string,
  result: UnacceptedWhatsappQueueResult
): Promise<void> {
  if (result.ok) {
    await appendOrderNotificationDiagnostic(writeClient, orderId, {
      source,
      level: 'info',
      message: 'Queued 3-minute business WhatsApp backup (Firestore scheduledJobs)',
      detail: {
        jobDocId: result.jobDocId,
        dueAtIso: new Date(Date.now() + 180_000).toISOString(),
      },
    })
  } else {
    await appendOrderNotificationDiagnostic(writeClient, orderId, {
      source,
      level: 'error',
      message: `Could not queue 3-minute WhatsApp backup: ${result.reason}`,
      detail:
        result.reason === 'write_failed'
          ? { reason: result.reason, message: result.message }
          : {
              reason: result.reason,
              hint: 'Enable Firestore API and ensure FIREBASE_* / service account on the server; confirm /api/jobs/process-due cron runs.',
            },
    })
  }
}
