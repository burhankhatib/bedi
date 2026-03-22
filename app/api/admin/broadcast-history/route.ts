import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { getFirestoreAdmin, isFirebaseAdminConfigured } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

/** Firestore-backed broadcast history (written by `process-due` when a job completes). */
export async function GET() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json([])
  }
  const db = getFirestoreAdmin()
  if (!db) {
    return NextResponse.json([])
  }

  try {
    const snap = await db.collection('broadcastHistory').orderBy('createdAtMs', 'desc').limit(200).get()
    const rows = snap.docs.map((d) => {
      const x = d.data()
      const createdMs = typeof x.createdAtMs === 'number' ? x.createdAtMs : Date.now()
      return {
        _id: d.id,
        message: typeof x.message === 'string' ? x.message : '',
        targets: Array.isArray(x.targets) ? x.targets : [],
        countries: typeof x.countries === 'string' ? x.countries : '',
        cities: typeof x.cities === 'string' ? x.cities : '',
        specificNumbers: typeof x.specificNumbers === 'string' ? x.specificNumbers : '',
        successfulNumbers: Array.isArray(x.successfulNumbers) ? x.successfulNumbers : [],
        failedNumbers: Array.isArray(x.failedNumbers) ? x.failedNumbers : [],
        sentCount: typeof x.sentCount === 'number' ? x.sentCount : 0,
        failedCount: typeof x.failedCount === 'number' ? x.failedCount : 0,
        totalFound: typeof x.totalFound === 'number' ? x.totalFound : 0,
        errors: typeof x.errors === 'string' ? x.errors : '',
        createdAt: new Date(createdMs).toISOString(),
      }
    })
    return NextResponse.json(rows)
  } catch (error: unknown) {
    console.error('[Admin Broadcast History]', error)
    const msg = error instanceof Error ? error.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
