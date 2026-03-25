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
  collection: (path: string) => { doc: (id?: string) => { id: string } }
  batch: () => {
    set: (ref: { id: string }, data: Record<string, unknown>) => void
    commit: () => Promise<unknown>
  }
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
    batch.set(ref, {
      ...rest,
      createdAtMs: e.createdAtMs ?? now,
    })
    n++
    if (n >= 400) {
      await batch.commit()
      batch = fs.batch()
      n = 0
    }
  }
  if (n > 0) await batch.commit()
}
