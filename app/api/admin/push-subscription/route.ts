import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { upsertUserPushSubscription } from '@/lib/user-push-subscriptions'

/**
 * POST - Save FCM token for Super Admin (WhatsApp inbox notifications).
 * Only Super Admin can use this. Uses roleContext "admin".
 */
export async function POST(req: NextRequest) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const fcmToken = body?.fcmToken && typeof body.fcmToken === 'string' ? body.fcmToken.trim() : null
  const pushClient = ['native', 'pwa', 'browser'].includes(body?.pushClient) ? body.pushClient : null
  if (!fcmToken) {
    return NextResponse.json({ error: 'fcmToken required' }, { status: 400 })
  }

  const result = await upsertUserPushSubscription({
    clerkUserId: userId,
    roleContext: 'admin',
    fcmToken,
    pushClient,
  })

  return NextResponse.json({ success: true, id: result?.id })
}

/** GET - Whether the current user (Super Admin) has push enabled for WhatsApp inbox. */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ enabled: false })

  const email = await getEmailForUser(userId, (await auth()).sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email ?? '')) {
    return NextResponse.json({ enabled: false })
  }

  const { getActiveSubscriptionsForUser } = await import('@/lib/user-push-subscriptions')
  const subs = await getActiveSubscriptionsForUser({ clerkUserId: userId, roleContext: 'admin' })
  const enabled = subs.some((s) => Array.isArray(s?.devices) && s.devices.length > 0)

  return NextResponse.json({ enabled })
}
