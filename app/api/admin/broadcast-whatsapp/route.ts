import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import {
  resolveRecipientsFromSnapshot,
  type BroadcastContactSnapshot,
  type BroadcastResolvedRecipient,
} from '@/lib/broadcast-contact-snapshot'
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
    return NextResponse.json({ error: 'Firebase Admin not configured. Cannot queue broadcast.' }, { status: 500 })
  }
  const db = getFirestoreAdmin()
  if (!db) {
    return NextResponse.json({ error: 'Firestore unavailable.' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const { targets, country, city, specificUsers, message, channels, excludedPhones } = body

    const selectedChannels = Array.isArray(channels) && channels.length > 0 ? channels : ['whatsapp']
    const excludedSet = new Set<string>(Array.isArray(excludedPhones) ? excludedPhones : [])

    if ((!targets || !Array.isArray(targets) || targets.length === 0) && (!specificUsers || !Array.isArray(specificUsers) || specificUsers.length === 0)) {
      return NextResponse.json({ error: 'Targets array or specific users are required' }, { status: 400 })
    }
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
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

    let recipients: BroadcastResolvedRecipient[] = resolveRecipientsFromSnapshot(snapshot, {
      targets: targets || [],
      country,
      city,
      specificUsers,
    })

    // Filter out excluded phones and strip undefined values for Firestore
    recipients = recipients
      .filter((r) => !excludedSet.has(r.phone))
      .map(
        (r): BroadcastResolvedRecipient => ({
          phone: r.phone,
          name: r.name,
          role: r.role,
          hasFcm: r.hasFcm,
          ...(r.clerkUserId ? { clerkUserId: r.clerkUserId } : {}),
          ...(r.country ? { country: r.country } : {}),
          ...(r.city ? { city: r.city } : {}),
        })
      )

    const totalFound = recipients.length

    if (totalFound === 0) {
      return NextResponse.json({ error: 'No recipients found matching criteria.' }, { status: 400 })
    }

    const jobId = randomUUID()
    const jobRef = db.collection('broadcastJobs').doc(jobId)
    await jobRef.set({
      type: 'broadcast',
      status: 'pending',
      recipients,
      cursor: 0,
      sentCount: 0,
      failedCount: 0,
      fcmSentCount: 0,
      fcmFailedCount: 0,
      channels: selectedChannels,
      message,
      targets: targets || [],
      countries: country || '',
      cities: city || '',
      specificNumbers: specificUsers && Array.isArray(specificUsers) ? specificUsers.map((u: { name?: string; phone?: string }) => `${u.name} (${u.phone})`).join(', ') : '',
      successfulNumbers: [],
      failedNumbers: [],
      errorsList: [],
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    })

    return NextResponse.json({
      success: true,
      totalFound,
      jobId,
    })
  } catch (error: unknown) {
    console.error('[Admin Broadcast WhatsApp]', error)
    const msg = error instanceof Error ? error.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
