import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { getFirestoreAdmin, isFirebaseAdminConfigured } from '@/lib/firebase-admin'
import { BROADCAST_DELIVERY_LOGS_COLLECTION } from '@/lib/broadcast-delivery-log'
import {
  WHATSAPP_OUTBOUND_STATUS_COLLECTION,
  wamidToFirestoreDocId,
} from '@/lib/whatsapp-outbound-status'

export const dynamic = 'force-dynamic'

const MAX_SCAN = 800
const DEFAULT_LIMIT = 150
const MAX_LIMIT = 400

type LogRow = {
  id: string
  jobId: string
  createdAt: string
  createdAtMs: number
  channel: string
  status: string
  recipientName: string
  recipientPhone: string
  clerkUserId?: string
  role?: string
  country?: string
  city?: string
  messagePreview?: string
  error?: string
  providerMessageId?: string
  broadcastCountries?: string
  broadcastCities?: string
  pushRoleContext?: string
  /** From Meta webhooks `statuses`: sent | delivered | read | failed — absent until webhook fires. */
  metaDeliveryStatus?: string
  metaDeliveryRecipientId?: string
  metaDeliveryErrors?: string
  metaDeliveryUpdatedAtMs?: number
}

function asStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function matches(row: LogRow, params: URLSearchParams): boolean {
  const channel = params.get('channel')?.trim()
  if (channel && row.channel !== channel) return false
  const status = params.get('status')?.trim()
  if (status && row.status !== status) return false
  const role = params.get('role')?.trim()
  if (role && (row.role || '') !== role) return false
  const jobId = params.get('jobId')?.trim()
  if (jobId && row.jobId !== jobId) return false
  const country = params.get('country')?.trim().toLowerCase()
  if (country) {
    const rc = (row.country || '').toLowerCase()
    const bc = (row.broadcastCountries || '').toLowerCase()
    if (!rc.includes(country) && !bc.includes(country)) return false
  }
  const city = params.get('city')?.trim().toLowerCase()
  if (city) {
    const rc = (row.city || '').toLowerCase()
    const bc = (row.broadcastCities || '').toLowerCase()
    if (!rc.includes(city) && !bc.includes(city)) return false
  }
  const q = params.get('q')?.trim().toLowerCase()
  if (q) {
    const hay = `${row.recipientName} ${row.recipientPhone} ${row.clerkUserId ?? ''}`.toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}

/** Super-admin audit: per-recipient WhatsApp / FCM / Web Push rows from mass broadcast jobs. */
export async function GET(req: NextRequest) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ rows: [], scanned: 0, note: 'firebase_not_configured' })
  }

  const db = getFirestoreAdmin()
  if (!db) {
    return NextResponse.json({ rows: [], scanned: 0, note: 'firestore_unavailable' })
  }

  const { searchParams } = new URL(req.url)
  let limit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10)
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT
  limit = Math.min(limit, MAX_LIMIT)

  try {
    const snap = await db
      .collection(BROADCAST_DELIVERY_LOGS_COLLECTION)
      .orderBy('createdAtMs', 'desc')
      .limit(MAX_SCAN)
      .get()

    const mapped: LogRow[] = snap.docs.map((d) => {
      const x = d.data()
      const ms = typeof x.createdAtMs === 'number' ? x.createdAtMs : Date.now()
      return {
        id: d.id,
        jobId: asStr(x.jobId) ?? '',
        createdAtMs: ms,
        createdAt: new Date(ms).toISOString(),
        channel: asStr(x.channel) ?? '',
        status: asStr(x.status) ?? '',
        recipientName: asStr(x.recipientName) ?? '',
        recipientPhone: asStr(x.recipientPhone) ?? '',
        clerkUserId: asStr(x.clerkUserId),
        role: asStr(x.role),
        country: asStr(x.country),
        city: asStr(x.city),
        messagePreview: asStr(x.messagePreview),
        error: asStr(x.error),
        providerMessageId: asStr(x.providerMessageId),
        broadcastCountries: asStr(x.broadcastCountries),
        broadcastCities: asStr(x.broadcastCities),
        pushRoleContext: asStr(x.pushRoleContext),
      }
    })

    const filtered = mapped.filter((row) => matches(row, searchParams)).slice(0, limit)
    const scannedCount = snap.docs.length

    const enrichWhatsappMeta = async () => {
      const waRows = filtered.filter((r) => r.channel === 'whatsapp' && r.providerMessageId)
      const chunk = 40
      for (let i = 0; i < waRows.length; i += chunk) {
        const slice = waRows.slice(i, i + chunk)
        await Promise.all(
          slice.map(async (row) => {
            const docId = wamidToFirestoreDocId(row.providerMessageId!)
            const st = await db.collection(WHATSAPP_OUTBOUND_STATUS_COLLECTION).doc(docId).get()
            const d = st.data()
            if (!d) return
            row.metaDeliveryStatus = typeof d.status === 'string' ? d.status : undefined
            row.metaDeliveryRecipientId = typeof d.recipientId === 'string' ? d.recipientId : undefined
            row.metaDeliveryUpdatedAtMs = typeof d.updatedAtMs === 'number' ? d.updatedAtMs : undefined
            const errs = d.errors
            if (Array.isArray(errs) && errs.length > 0) {
              try {
                row.metaDeliveryErrors = JSON.stringify(errs)
              } catch {
                row.metaDeliveryErrors = String(errs)
              }
            }
          })
        )
      }
    }
    await enrichWhatsappMeta()

    return NextResponse.json({
      rows: filtered,
      scanned: scannedCount,
      maxScan: MAX_SCAN,
      hint:
        scannedCount >= MAX_SCAN
          ? 'Showing the newest events only (scan cap). Narrow filters or add date range in a future update.'
          : undefined,
    })
  } catch (error: unknown) {
    console.error('[broadcast-delivery-logs]', error)
    const msg = error instanceof Error ? error.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
