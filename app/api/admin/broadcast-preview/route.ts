import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { resolveRecipientsFromSnapshot, type BroadcastContactSnapshot } from '@/lib/broadcast-contact-snapshot'
import { getFirestoreAdmin, isFirebaseAdminConfigured } from '@/lib/firebase-admin'

const SNAPSHOT_DOC = 'snapshot'
const CACHE_COLLECTION = 'broadcastContactCache'

export async function POST(req: Request) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ error: 'Firebase Admin not configured. Cannot preview broadcast.' }, { status: 500 })
  }
  const db = getFirestoreAdmin()
  if (!db) {
    return NextResponse.json({ error: 'Firestore unavailable.' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const { targets, country, city, specificUsers } = body

    if ((!targets || !Array.isArray(targets) || targets.length === 0) && (!specificUsers || !Array.isArray(specificUsers) || specificUsers.length === 0)) {
      return NextResponse.json({ error: 'Targets array or specific users are required' }, { status: 400 })
    }

    const snapDoc = await db.collection(CACHE_COLLECTION).doc(SNAPSHOT_DOC).get()
    if (!snapDoc.exists) {
      return NextResponse.json(
        {
          error:
            'Contact cache is empty. Open Admin → Broadcast and run “Sync contacts from CMS” once, then try again.',
        },
        { status: 400 }
      )
    }
    const raw = snapDoc.data()
    if (!raw || !Array.isArray(raw.tenants) || !Array.isArray(raw.drivers)) {
      return NextResponse.json(
        {
          error:
            'Contact cache is invalid or incomplete. Run “Sync contacts from CMS” again.',
        },
        { status: 400 }
      )
    }

    const snapshot: Omit<BroadcastContactSnapshot, 'syncedAtMs'> = {
      tenants: raw.tenants as BroadcastContactSnapshot['tenants'],
      drivers: raw.drivers as BroadcastContactSnapshot['drivers'],
      customersFromOrders: Array.isArray(raw.customersFromOrders)
        ? (raw.customersFromOrders as BroadcastContactSnapshot['customersFromOrders'])
        : [],
      customersDirect: Array.isArray(raw.customersDirect)
        ? (raw.customersDirect as BroadcastContactSnapshot['customersDirect'])
        : [],
      fcmUsers: Array.isArray(raw.fcmUsers) ? raw.fcmUsers : [],
      locationCountries: Array.isArray(raw.locationCountries) ? raw.locationCountries : [],
      locationCities: Array.isArray(raw.locationCities) ? raw.locationCities : [],
    }

    const recipients = resolveRecipientsFromSnapshot(snapshot, {
      targets: targets || [],
      country,
      city,
      specificUsers,
    })

    return NextResponse.json({
      totalFound: recipients.length,
      sample: recipients, // Changed to return all
    })
  } catch (error) {
    console.error('[BroadcastPreviewError]', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
