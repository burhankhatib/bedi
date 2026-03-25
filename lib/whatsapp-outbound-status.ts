import { createHash } from 'crypto'

/**
 * Firestore collection: latest WhatsApp Cloud API status per outbound wamid (from webhooks `statuses`).
 * Graph API "success" only means accepted; delivery is sent/delivered/read/failed here.
 */
export const WHATSAPP_OUTBOUND_STATUS_COLLECTION = 'whatsappOutboundStatus'

/** Stable Firestore doc id from full wamid string (ids may contain chars unsafe for paths). */
export function wamidToFirestoreDocId(wamid: string): string {
  return createHash('sha256').update(wamid, 'utf8').digest('hex')
}
