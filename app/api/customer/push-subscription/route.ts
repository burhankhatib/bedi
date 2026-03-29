import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkDeviceToken, getActiveSubscriptionsForUser, upsertUserPushSubscription } from '@/lib/user-push-subscriptions'
import { sendConnectionConfirmationFcm } from '@/lib/send-connection-confirmation'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** GET - Customer push health check for signed-in users. */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ hasPush: false, status: 'not_found', needsRefresh: false })
  const currentToken = req.nextUrl.searchParams.get('token')
  if (currentToken) {
    const checkResult = await checkDeviceToken({
      clerkUserId: userId,
      roleContext: 'customer',
      fcmToken: currentToken,
    })
    if (checkResult) {
      return NextResponse.json({
        hasPush: checkResult.status === 'ok' || checkResult.status === 'refreshed',
        needsRefresh: checkResult.status === 'not_found',
        status: checkResult.status,
      })
    }
  }
  const central = await getActiveSubscriptionsForUser({
    clerkUserId: userId,
    roleContext: 'customer',
  })
  const hasPush = central.some((doc) => Array.isArray(doc.devices) && doc.devices.length > 0)
  return NextResponse.json({ hasPush, status: hasPush ? 'ok' : 'not_found', needsRefresh: false })
}

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
  const pushClient = ['native', 'pwa', 'browser'].includes(body?.pushClient) ? body.pushClient : null
  if (!fcmToken) {
    return NextResponse.json({ error: 'fcmToken required' }, { status: 400 })
  }

  try {
    const existing = await writeClient.fetch<{ _id: string } | null>(
      `*[_type == "customerPushSubscription" && fcmToken == $fcmToken][0]{ _id }`,
      { fcmToken }
    )
    let wasNewToken = false
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
      wasNewToken = true
    }

    if (userId) {
      const result = await upsertUserPushSubscription({
        clerkUserId: userId,
        roleContext: 'customer',
        fcmToken,
        deviceInfo: req.headers.get('user-agent') ?? undefined,
        pushClient,
      })
      if (result?.created) wasNewToken = true
      console.info('[customer-push-subscription] central upsert', {
        userId,
        created: result?.created ?? false,
        source,
        tenantSlug,
        isIOS,
        standalone,
      })
    }

    if (wasNewToken) {
      await sendConnectionConfirmationFcm(fcmToken).catch(() => {})
    }

    return NextResponse.json({ success: true, linkedUser: Boolean(userId) })
  } catch (e) {
    console.error('[customer push-subscription]', e)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
