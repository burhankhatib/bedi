/**
 * Per-recipient audit trail for admin mass broadcast (WhatsApp template + FCM / Web Push).
 * Stored in Firestore `broadcastDeliveryLogs` (super-admin UI + API).
 */

export const BROADCAST_DELIVERY_LOGS_COLLECTION = 'broadcastDeliveryLogs'

export type BroadcastDeliveryChannel = 'whatsapp' | 'fcm' | 'web_push'

export type BroadcastDeliveryLogInput = {
  jobId: string
  channel: BroadcastDeliveryChannel
  status: 'success' | 'failed' | 'skipped'
  recipientName: string
  recipientPhone: string
  clerkUserId?: string
  role?: string
  country?: string
  city?: string
  messagePreview?: string
  error?: string
  providerMessageId?: string
  /** Job-level filters from the broadcast form (comma-separated lowercased values). */
  broadcastCountries?: string
  broadcastCities?: string
  pushRoleContext?: string
  createdAtMs?: number
}

type FirestoreBatchDb = {
  collection: (path: string) => { doc: (id?: string) => unknown }
  batch: () => {
    set: (ref: unknown, data: Record<string, unknown>) => void
    commit: () => Promise<unknown>
  }
}

/** Firestore rejects `undefined` field values — strips them so batch commits succeed. */
function omitUndefinedFields(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

export async function flushBroadcastDeliveryLogs(db: unknown, entries: BroadcastDeliveryLogInput[]): Promise<void> {
  if (!entries.length) return
  const fs = db as FirestoreBatchDb
  if (typeof fs.batch !== 'function') {
    console.warn('[broadcast-delivery-log] Firestore batch() unavailable; logs not persisted')
    return
  }
  const now = Date.now()
  let batch = fs.batch()
  let n = 0
  for (const e of entries) {
    const ref = fs.collection(BROADCAST_DELIVERY_LOGS_COLLECTION).doc()
    const { createdAtMs: _c, ...rest } = e
    const payload = omitUndefinedFields({
      ...rest,
      createdAtMs: e.createdAtMs ?? now,
    })
    batch.set(ref, payload)
    n++
    if (n >= 400) {
      await batch.commit()
      batch = fs.batch()
      n = 0
    }
  }
  if (n > 0) await batch.commit()
}
