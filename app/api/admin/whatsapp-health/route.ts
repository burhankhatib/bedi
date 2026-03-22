import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { getFirestoreAdmin, isFirebaseAdminConfigured } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const results: any = {
    timestamp: new Date().toISOString(),
    environment: {
      phoneId: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
      accountId: !!process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
      accessToken: !!process.env.WHATSAPP_ACCESS_TOKEN,
      webhookToken: !!process.env.WHATSAPP_VERIFY_TOKEN,
      firestore: isFirebaseAdminConfigured(),
    },
    metaApi: {
      status: 'unknown',
    },
    firestore: {
      status: 'unknown',
    }
  }

  // Check Meta API
  if (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
    const version = (process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0').trim()
    const vStr = version.startsWith('v') ? version : `v${version}`
    const url = `https://graph.facebook.com/${vStr}/${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=id,display_phone_number,name_status`
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }
      })
      if (res.ok) {
        const data = await res.json()
        results.metaApi = {
          status: 'ok',
          phoneId: data.id,
          displayPhone: data.display_phone_number,
          nameStatus: data.name_status,
        }
      } else {
        const errText = await res.text()
        results.metaApi = { status: 'error', code: res.status, detail: errText.slice(0, 200) }
      }
    } catch (e: any) {
      results.metaApi = { status: 'error', detail: e.message }
    }
  } else {
    results.metaApi.status = 'missing_credentials'
  }

  // Check Firestore
  if (isFirebaseAdminConfigured()) {
    try {
      const db = getFirestoreAdmin()
      if (db) {
        // Just verify we can ping the collection
        await db.collection('scheduledJobs').limit(1).get()
        results.firestore.status = 'ok'
      } else {
        results.firestore.status = 'unavailable'
      }
    } catch (e: any) {
      results.firestore = { status: 'error', detail: e.message }
    }
  } else {
    results.firestore.status = 'not_configured'
  }

  return NextResponse.json(results)
}
