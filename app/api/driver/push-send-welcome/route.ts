import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendPushNotificationDetailed, isPushConfigured } from '@/lib/push'
import { sendFCMToTokenDetailed, isFCMConfigured } from '@/lib/fcm'
import { getRandomDriverWelcome } from '@/lib/welcome-push-templates'
import { getMorningEncouragementPushAr } from '@/lib/driver-push-messages'
import { removeDevice } from '@/lib/user-push-subscriptions'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })
const DAY_MS = 24 * 60 * 60 * 1000

/** POST - Send one daily welcome push to the current driver (random Palestinian-style template). */
export async function POST(_req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isFCMConfigured() && !isPushConfigured()) {
    return NextResponse.json({ sent: false, reason: 'push_not_configured' })
  }

  const [driver, centralSubs] = await Promise.all([
    writeClient.fetch<{
      _id: string
      nickname?: string
      name?: string
      lastWelcomePushAt?: string
      fcmToken?: string
      pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
    } | null>(
      `*[_type == "driver" && clerkUserId == $userId][0]{
        _id,
        nickname,
        name,
        lastWelcomePushAt,
        fcmToken,
        "pushSubscription": pushSubscription
      }`,
      { userId }
    ),
    writeClient.fetch<Array<{
      _id: string
      lastWelcomePushAt?: string
      devices?: Array<{ _key?: string; fcmToken?: string; webPush?: { endpoint?: string; p256dh?: string; auth?: string } }>
    }>>(
      `*[_type == "userPushSubscription" && clerkUserId == $userId && roleContext == "driver" && isActive != false]{
        _id,
        lastWelcomePushAt,
        devices
      }`,
      { userId }
    ),
  ])
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  const centralLastWelcome = (centralSubs ?? [])
    .map((s) => s.lastWelcomePushAt ? new Date(s.lastWelcomePushAt).getTime() : 0)
    .reduce((max, v) => Math.max(max, v), 0)
  const driverLastWelcome = driver.lastWelcomePushAt ? new Date(driver.lastWelcomePushAt).getTime() : 0
  const lastWelcomeMs = Math.max(driverLastWelcome, centralLastWelcome)
  const nowMs = Date.now()
  if (lastWelcomeMs && nowMs - lastWelcomeMs < DAY_MS) {
    return NextResponse.json({ sent: false, skipped: 'within_24h' })
  }

  const displayName = driver.nickname || driver.name
  // Morning hours (5–11am Palestine ≈ UTC 2–9): send encouraging morning message; otherwise random welcome.
  const hour = new Date().getUTCHours()
  const isMorning = hour >= 2 && hour < 9
  const { title, body } = isMorning ? getMorningEncouragementPushAr(displayName) : getRandomDriverWelcome(displayName)
  const payload = { title, body, url: '/driver/orders', dir: 'rtl' as const }

  let sent = false
  const cleanupPromises: Promise<void>[] = []
  const seen = new Set<string>()

  // Prefer central subscriptions (multi-device)
  for (const sub of centralSubs ?? []) {
    for (const device of sub.devices ?? []) {
      const fcm = (device.fcmToken ?? '').trim()
      const endpoint = (device.webPush?.endpoint ?? '').trim()
      if (!fcm && !endpoint) continue
      const dedupeKey = fcm ? `fcm:${fcm}` : `wp:${endpoint}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

      let delivered = false
      if (fcm && isFCMConfigured()) {
        const result = await sendFCMToTokenDetailed(fcm, payload)
        if (result.ok) {
          sent = true
          delivered = true
        } else if (result.permanent) {
          cleanupPromises.push(removeDevice({ clerkUserId: userId, roleContext: 'driver', fcmToken: fcm }))
        }
      }

      if (!delivered && endpoint && device.webPush?.p256dh && device.webPush?.auth && isPushConfigured()) {
        const result = await sendPushNotificationDetailed(
          { endpoint, keys: { p256dh: device.webPush.p256dh, auth: device.webPush.auth } },
          payload
        )
        if (result.ok) {
          sent = true
        } else if (result.permanent) {
          cleanupPromises.push(removeDevice({ clerkUserId: userId, roleContext: 'driver', endpoint }))
        }
      }
    }
  }

  // Legacy fallback for older docs
  if (!sent) {
    const legacyFcm = (driver.fcmToken ?? '').trim()
    if (legacyFcm && isFCMConfigured()) {
      const result = await sendFCMToTokenDetailed(legacyFcm, payload)
      sent = result.ok
    }
    if (!sent && driver.pushSubscription?.endpoint && driver.pushSubscription.p256dh && driver.pushSubscription.auth && isPushConfigured()) {
      const result = await sendPushNotificationDetailed(
        {
          endpoint: driver.pushSubscription.endpoint,
          keys: { p256dh: driver.pushSubscription.p256dh, auth: driver.pushSubscription.auth },
        },
        payload
      )
      sent = result.ok
    }
  }

  if (sent) {
    await writeClient.patch(driver._id).set({ lastWelcomePushAt: new Date(nowMs).toISOString() }).commit().catch(() => {})
  }
  if (sent && (centralSubs?.length ?? 0) > 0) {
    await Promise.all(
      (centralSubs ?? []).map((sub) =>
        writeClient.patch(sub._id).set({ lastWelcomePushAt: new Date(nowMs).toISOString() }).commit().catch(() => {})
      )
    ).catch(() => {})
  }
  if (cleanupPromises.length > 0) {
    Promise.all(cleanupPromises).catch(() => {})
  }

  return NextResponse.json({ sent })
}
