import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { isFCMConfigured } from '@/lib/fcm'
import { isPushConfigured } from '@/lib/push'
import { getFirestoreAdmin, isFirebaseAdminConfigured } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

const freshClient = client.withConfig({ useCdn: false, token: token || undefined })

const ORDER_NOTIFICATIONS_GROQ = `*[_type == "order" && _id == $orderId][0]{
  _id,
  orderNumber,
  status,
  createdAt,
  scheduledFor,
  notifyAt,
  reminderSent,
  businessWhatsappNotifiedAt,
  businessWhatsappInstantNotifiedAt,
  businessWhatsappUnacceptedReminderAt,
  tenantNewOrderPushSent,
  tenantNewOrderPushSentAt,
  deliveryFeePaidByBusiness,
  orderType,
  notificationDiagnostics,
  "tenantId": site._ref,
  "tenantSlug": site->slug.current,
  "tenantName": site->name,
  "prioritizeWhatsapp": site->prioritizeWhatsapp,
  "tenantOwnerPhoneDefined": defined(site->ownerPhone)
}`

/**
 * Super-admin: aggregated notification diagnostics for one order (Sanity log + Firestore job snapshot).
 * GET /api/admin/orders/[orderId]/notifications-debug
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!token) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const { orderId } = await params
  if (!orderId?.trim()) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const order = await freshClient.fetch(ORDER_NOTIFICATIONS_GROQ, { orderId })
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const jobDocId = `order_unaccepted_whatsapp:${orderId}`
  let firestoreSnapshot: Record<string, unknown> | null = null
  let firestoreError: string | null = null

  if (!isFirebaseAdminConfigured()) {
    firestoreError = 'firebase_admin_not_configured'
  } else {
    try {
      const db = getFirestoreAdmin()
      if (!db) {
        firestoreError = 'firestore_unavailable'
      } else {
        const snap = await db.collection('scheduledJobs').doc(jobDocId).get()
        const data = snap.exists ? snap.data() : undefined
        firestoreSnapshot =
          snap.exists && data ? { _ref: jobDocId, ...(data as Record<string, unknown>) } : null
      }
    } catch (e) {
      firestoreError = e instanceof Error ? e.message : String(e)
    }
  }

  return NextResponse.json({
    orderId,
    sanity: order,
    firestore: {
      jobDocId,
      document: firestoreSnapshot,
      readError: firestoreError,
    },
    environment: {
      fcmConfigured: isFCMConfigured(),
      webPushConfigured: isPushConfigured(),
      firebaseAdminConfigured: isFirebaseAdminConfigured(),
    },
    hint: 'See sanity.notificationDiagnostics (newest rows at end). Firestore document should exist with status pending→processing→done if the 3-minute job pipeline is healthy.',
  })
}
