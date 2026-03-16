import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { upsertUserPushSubscription, checkDeviceToken } from '@/lib/user-push-subscriptions'
import { sendConnectionConfirmationFcm } from '@/lib/send-connection-confirmation'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** GET - Whether the current driver has push enabled (fcmToken or pushSubscription). */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const currentToken = req.nextUrl.searchParams.get('token')
  // Support explicit token health checks like tenant flow
  if (currentToken) {
    const checkResult = await checkDeviceToken({
      clerkUserId: userId,
      roleContext: 'driver',
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
  const [driver, centralSubs] = await Promise.all([
    writeClient.fetch<{ fcmToken?: string; pushSubscription?: { endpoint?: string } } | null>(
      `*[_type == "driver" && clerkUserId == $userId][0]{ fcmToken, "pushSubscription": pushSubscription }`,
      { userId }
    ),
    writeClient.fetch<Array<{ _id: string, devices?: any[] }>>(
      `*[_type == "userPushSubscription" && clerkUserId == $userId && roleContext == "driver" && isActive != false][0..0]{ _id, devices }`,
      { userId }
    )
  ])
  const hasLegacyPush = !!(driver?.fcmToken || driver?.pushSubscription?.endpoint)
  const hasCentralPush = !!(centralSubs && centralSubs.length > 0 && centralSubs[0].devices && centralSubs[0].devices.length > 0)
  const hasPush = hasLegacyPush || hasCentralPush
  return NextResponse.json({ hasPush, needsRefresh: false, status: hasPush ? 'ok' : 'not_found' })
}

/** POST - Save push subscription for the current driver. Accepts FCM token and/or Web Push subscription; both can be sent so server can fall back to Web Push when FCM fails. */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })
  const body = await req.json().catch(() => ({}))
  const fcmToken = body?.fcmToken && typeof body.fcmToken === 'string' ? body.fcmToken.trim() : null
  const endpoint = body?.endpoint && typeof body.endpoint === 'string' ? body.endpoint : null
  const keys = body?.keys && typeof body.keys === 'object' ? body.keys : null
  const p256dh = keys?.p256dh && typeof keys.p256dh === 'string' ? keys.p256dh : null
  const authKey = keys?.auth && typeof keys.auth === 'string' ? keys.auth : null

  const hasWebPush = !!(endpoint && p256dh && authKey)
  if (!fcmToken && !hasWebPush) {
    return NextResponse.json({ error: 'fcmToken or (endpoint and keys.p256dh, keys.auth) required' }, { status: 400 })
  }

  // Central Upsert
  await upsertUserPushSubscription({
    clerkUserId: userId,
    roleContext: 'driver',
    fcmToken,
    webPush: hasWebPush ? { endpoint: endpoint!, p256dh: p256dh!, auth: authKey! } : null,
    deviceInfo: req.headers.get('user-agent') ?? undefined,
  }).catch((e) => console.warn('[driver push] central upsert failed', e))

  const driver = await writeClient.fetch<{ _id: string } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  const patch = writeClient.patch(driver._id)
  if (fcmToken) patch.set({ fcmToken })
  if (hasWebPush) {
    patch.set({
      pushSubscription: {
        endpoint: endpoint!,
        p256dh: p256dh!,
        auth: authKey!,
      },
    })
  }
  await patch.commit()

  if (fcmToken) {
    sendConnectionConfirmationFcm(fcmToken, { url: '/driver/orders' }).catch(() => {})
  }
  return NextResponse.json({ success: true, hasFcm: !!fcmToken })
}
