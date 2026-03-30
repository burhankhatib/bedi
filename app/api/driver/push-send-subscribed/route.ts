import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendPushNotificationDetailed, isPushConfigured } from '@/lib/push'
import { sendFCMToTokenDetailed, isFCMConfigured } from '@/lib/fcm'
import { removeDevice } from '@/lib/user-push-subscriptions'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

function getSubscriptionConfirmedMessage(nick: string | undefined | null): { title: string; body: string } {
  const name = (nick ?? '').trim() || 'صديقي'
  return {
    title: `${name}، الإشعارات جاهزة ✅`,
    body: 'تم تفعيل الإشعارات بنجاح. ادخل متصلاً لاستقبال طلبات التوصيل.',
  }
}

/**
 * POST — Send a confirmation FCM immediately after the driver successfully subscribes to push
 * notifications. No daily throttle — each successful subscription warrants a confirmation ping.
 */
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
      fcmToken?: string
      pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
    } | null>(
      `*[_type == "driver" && clerkUserId == $userId][0]{
        _id, nickname, name, fcmToken, "pushSubscription": pushSubscription
      }`,
      { userId }
    ),
    writeClient.fetch<Array<{
      _id: string
      devices?: Array<{ _key?: string; fcmToken?: string; pushClient?: string; webPush?: { endpoint?: string; p256dh?: string; auth?: string } }>
    }>>(
      `*[_type == "userPushSubscription" && clerkUserId == $userId && roleContext == "driver" && isActive != false]{
        _id, devices
      }`,
      { userId }
    ),
  ])

  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  const displayName = driver.nickname || driver.name
  const { title, body } = getSubscriptionConfirmedMessage(displayName)
  const payload = { title, body, url: '/driver/orders', dir: 'rtl' as const }

  let sent = false
  const cleanupPromises: Promise<void>[] = []
  const seen = new Set<string>()

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
        const payloadWithClient = device.pushClient ? { ...payload, pushClient: device.pushClient as 'native' | 'pwa' | 'browser' } : payload
        const result = await sendFCMToTokenDetailed(fcm, payloadWithClient)
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

  if (!sent) {
    const legacyFcm = (driver.fcmToken ?? '').trim()
    if (legacyFcm && isFCMConfigured()) {
      const result = await sendFCMToTokenDetailed(legacyFcm, payload)
      sent = result.ok
    }
    if (!sent && driver.pushSubscription?.endpoint && driver.pushSubscription.p256dh && driver.pushSubscription.auth && isPushConfigured()) {
      const result = await sendPushNotificationDetailed(
        { endpoint: driver.pushSubscription.endpoint, keys: { p256dh: driver.pushSubscription.p256dh, auth: driver.pushSubscription.auth } },
        payload
      )
      sent = result.ok
    }
  }

  if (cleanupPromises.length > 0) {
    Promise.all(cleanupPromises).catch(() => {})
  }

  return NextResponse.json({ sent })
}
