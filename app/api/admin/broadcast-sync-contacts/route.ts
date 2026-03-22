import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { fetchBroadcastContactSnapshotFromSanity } from '@/lib/broadcast-contact-snapshot'
import { getFirestoreAdmin, isFirebaseAdminConfigured } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

const SNAPSHOT_DOC = 'snapshot'
const CACHE_COLLECTION = 'broadcastContactCache'

/** GET — last sync metadata (no Sanity calls). */
export async function GET() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 })
  }
  const db = getFirestoreAdmin()
  if (!db) {
    return NextResponse.json({ error: 'Firestore unavailable' }, { status: 500 })
  }

  try {
    const doc = await db.collection(CACHE_COLLECTION).doc(SNAPSHOT_DOC).get()
    if (!doc.exists) {
      return NextResponse.json({ syncedAtMs: null, counts: null })
    }
    const data = doc.data()
    if (!data) {
      return NextResponse.json({ syncedAtMs: null, counts: null })
    }
    const tenants = Array.isArray(data.tenants) ? data.tenants.length : 0
    const drivers = Array.isArray(data.drivers) ? data.drivers.length : 0
    const customersFromOrders = Array.isArray(data.customersFromOrders) ? data.customersFromOrders.length : 0
    const customersDirect = Array.isArray(data.customersDirect) ? data.customersDirect.length : 0
    return NextResponse.json({
      syncedAtMs: typeof data.syncedAtMs === 'number' ? data.syncedAtMs : null,
      counts: { tenants, drivers, customersFromOrders, customersDirect },
    })
  } catch (e: unknown) {
    console.error('[broadcast-sync-contacts GET]', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/** POST — pull from Sanity once, write Firestore snapshot (batched Sanity usage). */
export async function POST() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 })
  }
  const db = getFirestoreAdmin()
  if (!db) {
    return NextResponse.json({ error: 'Firestore unavailable' }, { status: 500 })
  }

  try {
    const partial = await fetchBroadcastContactSnapshotFromSanity()
    const syncedAtMs = Date.now()
    await db.collection(CACHE_COLLECTION).doc(SNAPSHOT_DOC).set({
      ...partial,
      syncedAtMs,
    })
    return NextResponse.json({
      ok: true,
      syncedAtMs,
      counts: {
        tenants: partial.tenants.length,
        drivers: partial.drivers.length,
        customersFromOrders: partial.customersFromOrders.length,
        customersDirect: partial.customersDirect.length,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Sync failed'
    console.error('[broadcast-sync-contacts POST]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
