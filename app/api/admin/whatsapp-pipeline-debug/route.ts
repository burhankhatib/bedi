import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { getFirestoreAdmin, isFirebaseAdminConfigured } from '@/lib/firebase-admin'
import { WHATSAPP_OUTBOUND_STATUS_COLLECTION } from '@/lib/whatsapp-outbound-status'

export const dynamic = 'force-dynamic'

const ERRORS_LIMIT = 120
const STATUS_LIMIT = 200

function docToRow(id: string, data: Record<string, unknown> | undefined) {
  return { id, ...(data ?? {}) }
}

/** Super-admin only: raw Firestore rows for WhatsApp delivery debugging. */
export async function GET() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({
      broadcastDeliveryErrors: [],
      whatsappOutboundStatus: [],
      note: 'Firebase Admin not configured',
    })
  }

  const db = getFirestoreAdmin()
  if (!db) {
    return NextResponse.json({
      broadcastDeliveryErrors: [],
      whatsappOutboundStatus: [],
      note: 'Firestore unavailable',
    })
  }

  const broadcastDeliveryErrors: Array<Record<string, unknown>> = []
  const whatsappOutboundStatus: Array<Record<string, unknown>> = []
  let errorsNote: string | undefined
  let statusNote: string | undefined

  try {
    const errSnap = await db
      .collection('broadcastDeliveryErrors')
      .orderBy('createdAtMs', 'desc')
      .limit(ERRORS_LIMIT)
      .get()
    for (const d of errSnap.docs) {
      broadcastDeliveryErrors.push(docToRow(d.id, d.data() as Record<string, unknown>))
    }
  } catch (e) {
    errorsNote = e instanceof Error ? e.message : String(e)
    try {
      const fallback = await db.collection('broadcastDeliveryErrors').limit(Math.min(ERRORS_LIMIT, 50)).get()
      for (const d of fallback.docs) {
        broadcastDeliveryErrors.push(docToRow(d.id, d.data() as Record<string, unknown>))
      }
      if (fallback.docs.length) {
        errorsNote = `${errorsNote} (showing unordered sample)`
      }
    } catch {
      /* empty */
    }
  }

  try {
    const stSnap = await db
      .collection(WHATSAPP_OUTBOUND_STATUS_COLLECTION)
      .orderBy('updatedAtMs', 'desc')
      .limit(STATUS_LIMIT)
      .get()
    for (const d of stSnap.docs) {
      whatsappOutboundStatus.push(docToRow(d.id, d.data() as Record<string, unknown>))
    }
  } catch (e) {
    statusNote = e instanceof Error ? e.message : String(e)
    try {
      const fallback = await db.collection(WHATSAPP_OUTBOUND_STATUS_COLLECTION).limit(Math.min(STATUS_LIMIT, 50)).get()
      for (const d of fallback.docs) {
        whatsappOutboundStatus.push(docToRow(d.id, d.data() as Record<string, unknown>))
      }
      if (fallback.docs.length) {
        statusNote = `${statusNote} (showing unordered sample)`
      }
    } catch {
      /* empty */
    }
  }

  return NextResponse.json({
    broadcastDeliveryErrors,
    whatsappOutboundStatus,
    limits: { errors: ERRORS_LIMIT, status: STATUS_LIMIT },
    notes: {
      errors: errorsNote,
      status: statusNote,
    },
  })
}
