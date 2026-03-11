import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { upsertUserPushSubscription } from '@/lib/user-push-subscriptions'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/**
 * POST - Register a customer device for push (FCM token).
 * Used by the Customer PWA so super admin and businesses can send push
 * (order tracking, announcements, ads). No auth required.
 */
export async function POST(req: NextRequest) {
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })
  const { userId } = await auth()
  const body = await req.json().catch(() => ({}))
  const fcmToken = body?.fcmToken && typeof body.fcmToken === 'string' ? body.fcmToken.trim() : null
  const source = body?.source && typeof body.source === 'string' ? body.source : 'unknown'
  const tenantSlug = body?.tenantSlug && typeof body.tenantSlug === 'string' ? body.tenantSlug.trim() : null
  const isIOS = body?.isIOS === true
  const standalone = body?.standalone === true
  if (!fcmToken) {
    return NextResponse.json({ error: 'fcmToken required' }, { status: 400 })
  }

  try {
    const existing = await writeClient.fetch<{ _id: string } | null>(
      `*[_type == "customerPushSubscription" && fcmToken == $fcmToken][0]{ _id }`,
      { fcmToken }
    )
    if (existing) {
      await writeClient.patch(existing._id).set({ createdAt: new Date().toISOString() }).commit()
      console.info('[customer-push-subscription] refreshed legacy token record', { source, tenantSlug, isIOS, standalone })
    } else {
      await writeClient.create({
        _type: 'customerPushSubscription',
        fcmToken,
        createdAt: new Date().toISOString(),
      })
      console.info('[customer-push-subscription] created legacy token record', { source, tenantSlug, isIOS, standalone })
    }

    if (userId) {
      const result = await upsertUserPushSubscription({
        clerkUserId: userId,
        roleContext: 'customer',
        fcmToken,
        deviceInfo: req.headers.get('user-agent') ?? undefined,
      })
      console.info('[customer-push-subscription] central upsert', {
        userId,
        created: result?.created ?? false,
        source,
        tenantSlug,
        isIOS,
        standalone,
      })
    }
    return NextResponse.json({ success: true, linkedUser: Boolean(userId) })
  } catch (e) {
    console.error('[customer push-subscription]', e)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
