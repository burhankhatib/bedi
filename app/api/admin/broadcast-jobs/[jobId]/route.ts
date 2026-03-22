import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { getFirestoreAdmin, isFirebaseAdminConfigured } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 })
  }

  const { jobId } = await params
  const db = getFirestoreAdmin()
  if (!db) {
    return NextResponse.json({ error: 'Firestore unavailable' }, { status: 500 })
  }

  try {
    const doc = await db.collection('broadcastJobs').doc(jobId).get()
    if (!doc.exists) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    const data = doc.data()
    const recipients = data?.recipients
    return NextResponse.json({
      status: data?.status,
      totalFound: Array.isArray(recipients) ? recipients.length : 0,
      sentCount: data?.sentCount || 0,
      failedCount: data?.failedCount || 0,
      cursor: data?.cursor || 0,
    })
  } catch (error) {
    console.error('[Broadcast Status GET]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
