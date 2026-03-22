import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { getFirestoreAdmin, isFirebaseAdminConfigured } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

const SNAPSHOT_DOC = 'snapshot'
const CACHE_COLLECTION = 'broadcastContactCache'

/** Country/city pickers — served from Firestore contact snapshot (sync via POST /api/admin/broadcast-sync-contacts). */
export async function GET() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ countries: [], cities: [] })
  }
  const db = getFirestoreAdmin()
  if (!db) {
    return NextResponse.json({ countries: [], cities: [] })
  }

  try {
    const doc = await db.collection(CACHE_COLLECTION).doc(SNAPSHOT_DOC).get()
    if (!doc.exists) {
      return NextResponse.json({ countries: [], cities: [] })
    }
    const data = doc.data()
    const countries = Array.isArray(data?.locationCountries) ? data.locationCountries : []
    const cities = Array.isArray(data?.locationCities) ? data.locationCities : []
    return NextResponse.json({ countries, cities })
  } catch (error: unknown) {
    console.error('[Admin Broadcast Locations]', error)
    const msg = error instanceof Error ? error.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
