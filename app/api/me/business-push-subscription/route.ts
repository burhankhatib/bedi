import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clientNoCdn } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { upsertUserPushSubscription } from '@/lib/user-push-subscriptions'

const writeClient = clientNoCdn.withConfig({ token: token || undefined, useCdn: false })

/** GET – whether the current user has push enabled for at least one business (any tenant has fcmToken). */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ enabled: false })
    let email = ''
    try {
      email = await getEmailForUser(userId, (await auth()).sessionClaims as Record<string, unknown> | null)
    } catch {}
    const clerkUserEmailLower = (email || '').trim().toLowerCase()
    const [tenants, centralSubs] = await Promise.all([
      clientNoCdn.fetch<Array<{ _id: string; fcmToken?: string; fcmTokens?: string[] }>>(
        `*[_type == "tenant" && (
          clerkUserId == $clerkUserId ||
          (defined($clerkUserEmailLower) && $clerkUserEmailLower != "" && (
            (defined(clerkUserEmail) && lower(clerkUserEmail) == $clerkUserEmailLower) ||
            (defined(coOwnerEmails) && $clerkUserEmailLower in coOwnerEmails)
          ))
        )]{ _id, fcmToken, fcmTokens }`,
        { clerkUserId: userId, clerkUserEmailLower: clerkUserEmailLower || undefined }
      ),
      clientNoCdn.fetch<Array<{ _id: string, devices?: any[] }>>(
        `*[_type == "userPushSubscription" && clerkUserId == $clerkUserId && roleContext == "tenant" && isActive != false][0..0]{ _id, devices }`,
        { clerkUserId: userId }
      )
    ])

    const list = Array.isArray(tenants) ? tenants : []
    const hasAnyLegacyToken = list.some(t => (t?.fcmTokens?.length ?? 0) > 0 || !!t?.fcmToken)
    const hasAnyCentralToken = centralSubs && centralSubs.length > 0 && centralSubs[0].devices && centralSubs[0].devices.length > 0
    
    const enabled = hasAnyLegacyToken || hasAnyCentralToken
    return NextResponse.json({ enabled })
  } catch {
    return NextResponse.json({ enabled: false })
  }
}

/**
 * POST /api/me/business-push-subscription
 * Saves the given FCM token to ALL tenants owned by the current user (unified Business PWA).
 * When any of their businesses receives a new order, they get one push notification.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

    const body = await req.json().catch(() => ({}))
    const fcmToken = body?.fcmToken && typeof body.fcmToken === 'string' ? body.fcmToken.trim() : null
    if (!fcmToken) {
      return NextResponse.json({ error: 'fcmToken required' }, { status: 400 })
    }

    let email = ''
    try {
      email = await getEmailForUser(userId, (await auth()).sessionClaims as Record<string, unknown> | null)
    } catch {
      // ignore
    }
    const clerkUserEmailLower = (email || '').trim().toLowerCase()
    const tenants = await clientNoCdn.fetch<Array<{ _id: string; fcmToken?: string; fcmTokens?: string[] }>>(
      `*[_type == "tenant" && (
        clerkUserId == $clerkUserId ||
        (defined($clerkUserEmailLower) && $clerkUserEmailLower != "" && (
          (defined(clerkUserEmail) && lower(clerkUserEmail) == $clerkUserEmailLower) ||
          (defined(coOwnerEmails) && $clerkUserEmailLower in coOwnerEmails)
        ))
      )]{ _id, fcmToken, fcmTokens }`,
      { clerkUserId: userId, clerkUserEmailLower: clerkUserEmailLower || undefined }
    )
    const list = Array.isArray(tenants) ? tenants : []
    if (list.length === 0) {
      return NextResponse.json({ error: 'No businesses found', saved: 0 }, { status: 400 })
    }

    for (const t of list) {
      if (!t?._id) continue
      
      // Upsert into central system to ensure full device reach
      await upsertUserPushSubscription({
        clerkUserId: userId,
        roleContext: 'tenant',
        siteId: t._id,
        fcmToken,
      }).catch((e) => console.warn('[business-push-subscription] central upsert failed', e))
      
      // Update legacy list for backward compatibility
      const existing = (t.fcmTokens ?? []).concat(t.fcmToken ? [t.fcmToken] : [])
      const nextTokens = [...new Set([...existing, fcmToken])].filter(Boolean)
      const patch = writeClient.patch(t._id).set({ fcmTokens: nextTokens })
      if (t.fcmToken) patch.unset(['fcmToken'])
      await patch.commit()
    }

    return NextResponse.json({ success: true, saved: list.length })
  } catch (e) {
    console.error('[business-push-subscription]', e)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
