import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getTenantIdBySlug } from '@/lib/tenant'
import { checkDeviceToken, getActiveSubscriptionsForUser, upsertUserPushSubscription } from '@/lib/user-push-subscriptions'
import { sendConnectionConfirmationFcm } from '@/lib/send-connection-confirmation'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/**
 * POST - Save customer push subscription for order status notifications.
 * Authenticated by possession of the tracking token (no login).
 * Body: { endpoint?, keys?: { p256dh, auth }, fcmToken? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  const { userId } = await auth()
  const { slug, token: trackingToken } = await params
  if (!slug?.trim() || !trackingToken?.trim()) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const tenantId = await getTenantIdBySlug(slug)
  if (!tenantId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const order = await client.fetch<{ _id: string; customerFcmToken?: string } | null>(
    `*[_type == "order" && site._ref == $tenantId && trackingToken == $trackingToken][0]{ _id, customerFcmToken }`,
    { tenantId, trackingToken }
  )
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const fcmToken = body?.fcmToken && typeof body.fcmToken === 'string' ? body.fcmToken.trim() : null
  const endpoint = body?.endpoint && typeof body.endpoint === 'string' ? body.endpoint : null
  const source = body?.source && typeof body.source === 'string' ? body.source : 'unknown'
  const isIOS = body?.isIOS === true
  const standalone = body?.standalone === true
  const keys = body?.keys && typeof body.keys === 'object' ? body.keys : null
  const pushClient = ['native', 'pwa', 'browser'].includes(body?.pushClient) ? body.pushClient : null
  const p256dh = keys?.p256dh && typeof keys.p256dh === 'string' ? keys.p256dh : null
  const authKey = keys?.auth && typeof keys.auth === 'string' ? keys.auth : null
  const hasWebPush = !!(endpoint && p256dh && authKey)

  if (!fcmToken && !hasWebPush) {
    return NextResponse.json({ error: 'fcmToken or (endpoint and keys.p256dh, keys.auth) required' }, { status: 400 })
  }

  const patch = writeClient.patch(order._id)
  if (fcmToken) patch.set({ customerFcmToken: fcmToken })
  if (hasWebPush) {
    patch.set({
      customerPushSubscription: {
        endpoint: endpoint!,
        p256dh: p256dh!,
        auth: authKey!,
      },
    })
  }
  await patch.commit()
  console.info('[track-push-subscription] order-link save', {
    orderId: order._id,
    source,
    isIOS,
    standalone,
    hasFcm: Boolean(fcmToken),
    hasWebPush,
  })

  const hadSameToken = !!(fcmToken && order.customerFcmToken && order.customerFcmToken.trim() === fcmToken)

  if (userId) {
    const result = await upsertUserPushSubscription({
      clerkUserId: userId,
      roleContext: 'customer',
      fcmToken: fcmToken ?? undefined,
      webPush: hasWebPush ? { endpoint: endpoint!, p256dh: p256dh!, auth: authKey! } : undefined,
      deviceInfo: req.headers.get('user-agent') ?? undefined,
      pushClient,
    })
    console.info('[track-push-subscription] central upsert', {
      orderId: order._id,
      userId,
      created: result?.created ?? false,
      hasFcm: Boolean(fcmToken),
      hasWebPush,
      source,
      isIOS,
      standalone,
    })
  }

  if (!hadSameToken && (fcmToken || hasWebPush)) {
    await sendConnectionConfirmationFcm(fcmToken ?? null, {
      url: `/t/${slug}/track/${trackingToken}`,
      webPush: hasWebPush ? { endpoint: endpoint!, p256dh: p256dh!, auth: authKey! } : undefined,
    }).catch(() => {})
  }

  return NextResponse.json({ success: true, linkedUser: Boolean(userId) })
}

/** GET - Whether this order has push enabled (for UI). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  const { userId } = await auth()
  const { slug, token: trackingToken } = await params
  if (!slug?.trim() || !trackingToken?.trim()) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 })
  }

  const tenantId = await getTenantIdBySlug(slug)
  if (!tenantId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const order = await client.fetch<{ customerFcmToken?: string; customerPushSubscription?: { endpoint?: string } } | null>(
    `*[_type == "order" && site._ref == $tenantId && trackingToken == $trackingToken][0]{
      customerFcmToken,
      "customerPushSubscription": customerPushSubscription
    }`,
    { tenantId, trackingToken }
  )
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const currentToken = req.nextUrl.searchParams.get('token')
  if (userId && currentToken) {
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

  let hasPush = !!(order.customerFcmToken || order.customerPushSubscription?.endpoint)
  if (!hasPush && userId) {
    const central = await getActiveSubscriptionsForUser({
      clerkUserId: userId,
      roleContext: 'customer',
    })
    hasPush = central.some((doc) => doc.devices && doc.devices.length > 0)
  }
  if (process.env.NODE_ENV === 'development') {
    console.info('[track-push-subscription] hasPush check', { userId: Boolean(userId), hasPush })
  }
  return NextResponse.json({ hasPush, needsRefresh: false, status: hasPush ? 'ok' : 'not_found' })
}
