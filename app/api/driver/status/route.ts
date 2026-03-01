import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'
import { getAutoOfflinePushAr } from '@/lib/driver-push-messages'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

const AUTO_OFFLINE_AFTER_MS = 8 * 60 * 60 * 1000 // 8 hours

/** PATCH driver online status. Updates isOnline, lastSeenAt, onlineSince. Cannot go offline while has active deliveries. */
export async function PATCH(req: NextRequest) {
  let userId: string | null = null
  try {
    const result = await auth()
    userId = result?.userId ?? null
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })
  const body = await req.json().catch(() => ({}))
  const wantOffline = body && body.isOnline === false
  const driver = await client.fetch<{ _id: string; isVerifiedByAdmin?: boolean; fcmToken?: string; pushSubscription?: { endpoint?: string } } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id, isVerifiedByAdmin, fcmToken, "pushSubscription": pushSubscription }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })
  // Require push to be enabled before going online (core business: driver must receive order alerts)
  if (!wantOffline) {
    if (driver.isVerifiedByAdmin !== true) {
      return NextResponse.json(
        { error: 'not_verified', message: 'Your profile is under review. You will be able to go online once verified.' },
        { status: 403 }
      )
    }

    const hasPush = !!(driver.fcmToken || driver.pushSubscription?.endpoint)
    if (!hasPush) {
      return NextResponse.json(
        { error: 'push_required', message: 'Enable push notifications on the Orders page before going online.' },
        { status: 400 }
      )
    }
  }
  if (wantOffline) {
    const activeCount = await client.fetch<number>(
      `count(*[_type == "order" && orderType == "delivery" && assignedDriver._ref == $driverId && status in ["preparing", "waiting_for_delivery", "driver_on_the_way", "out-for-delivery"]])`,
      { driverId: driver._id }
    )
    if (activeCount > 0) {
      return NextResponse.json(
        { error: 'active_deliveries', message: 'Complete or cancel your deliveries before going offline.', activeDeliveriesCount: activeCount },
        { status: 400 }
      )
    }
  }
  const now = new Date().toISOString()
  const isOnline = !wantOffline
  const patch: Record<string, unknown> = { isOnline, lastSeenAt: now }
  if (isOnline) patch.onlineSince = now
  const p = writeClient.patch(driver._id).set(patch)
  if (!isOnline) p.unset(['onlineSince'])
  await p.commit()
  return NextResponse.json({
    isOnline,
    lastSeenAt: now,
    onlineSince: isOnline ? now : undefined,
  })
}

/** GET current driver's online status, onlineSince, and activeDeliveriesCount. Uses fresh read (no CDN) so status is up to date after toggles. Auto-offlines driver and sends FCM if online for 8+ hours. */
export async function GET() {
  let userId: string | null = null
  try {
    const result = await auth()
    userId = result?.userId ?? null
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const driver = await writeClient.fetch<{
    _id: string
    isOnline?: boolean
    isVerifiedByAdmin?: boolean
    lastSeenAt?: string
    onlineSince?: string
    nickname?: string
    fcmToken?: string
    pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
  } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id, isOnline, isVerifiedByAdmin, lastSeenAt, onlineSince, nickname, fcmToken, "pushSubscription": pushSubscription }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  const now = Date.now()
  const onlineSinceMs = driver.onlineSince ? new Date(driver.onlineSince).getTime() : 0
  const shouldAutoOffline =
    driver.isOnline === true &&
    driver.onlineSince &&
    onlineSinceMs > 0 &&
    now - onlineSinceMs >= AUTO_OFFLINE_AFTER_MS

  if (shouldAutoOffline && token) {
    await writeClient
      .patch(driver._id)
      .set({ isOnline: false, lastSeenAt: new Date().toISOString() })
      .unset(['onlineSince'])
      .commit()

    const { title, body } = getAutoOfflinePushAr(driver.nickname)
    const payload = { title, body, url: '/driver' }
    let sent = false
    if (driver.fcmToken && isFCMConfigured()) {
      sent = await sendFCMToToken(driver.fcmToken, payload)
    }
    if (
      !sent &&
      driver.pushSubscription?.endpoint &&
      driver.pushSubscription?.p256dh &&
      driver.pushSubscription?.auth &&
      isPushConfigured()
    ) {
      await sendPushNotification(
        {
          endpoint: driver.pushSubscription.endpoint,
          keys: { p256dh: driver.pushSubscription.p256dh, auth: driver.pushSubscription.auth },
        },
        payload
      )
    }

    const activeDeliveriesCount = await writeClient.fetch<number>(
      `count(*[_type == "order" && orderType == "delivery" && assignedDriver._ref == $driverId && status in ["preparing", "waiting_for_delivery", "driver_on_the_way", "out-for-delivery"]])`,
      { driverId: driver._id }
    )
    return NextResponse.json({
      isOnline: false,
      lastSeenAt: new Date().toISOString(),
      onlineSince: undefined,
      activeDeliveriesCount,
      autoOfflined: true,
    })
  }

  const activeDeliveriesCount = await writeClient.fetch<number>(
    `count(*[_type == "order" && orderType == "delivery" && assignedDriver._ref == $driverId && status in ["preparing", "waiting_for_delivery", "driver_on_the_way", "out-for-delivery"]])`,
    { driverId: driver._id }
  )
  return NextResponse.json({
    isOnline: driver.isOnline ?? false,
    isVerifiedByAdmin: driver.isVerifiedByAdmin ?? false,
    lastSeenAt: driver.lastSeenAt,
    onlineSince: driver.onlineSince,
    activeDeliveriesCount,
  })
}
