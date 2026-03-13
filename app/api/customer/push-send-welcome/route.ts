import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendPushNotificationDetailed, isPushConfigured } from '@/lib/push'
import { sendFCMToTokenDetailed, isFCMConfigured } from '@/lib/fcm'
import { getRandomCustomerWelcome } from '@/lib/welcome-push-templates'
import { removeDevice } from '@/lib/user-push-subscriptions'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })
const DAY_MS = 24 * 60 * 60 * 1000

/** POST - Send one daily welcome push to current signed-in customer. */
export async function POST(_req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isFCMConfigured() && !isPushConfigured()) {
    return NextResponse.json({ sent: false, reason: 'push_not_configured' })
  }

  const [customer, centralSubs] = await Promise.all([
    writeClient.fetch<{ _id: string; name?: string; lastWelcomePushAt?: string } | null>(
      `*[_type == "customer" && clerkUserId == $userId][0]{ _id, name, lastWelcomePushAt }`,
      { userId }
    ),
    writeClient.fetch<Array<{
      _id: string
      lastWelcomePushAt?: string
      devices?: Array<{ _key?: string; fcmToken?: string; webPush?: { endpoint?: string; p256dh?: string; auth?: string } }>
    }>>(
      `*[_type == "userPushSubscription" && clerkUserId == $userId && roleContext == "customer" && isActive != false]{
        _id,
        lastWelcomePushAt,
        devices
      }`,
      { userId }
    ),
  ])

  const centralLastWelcome = (centralSubs ?? [])
    .map((s) => s.lastWelcomePushAt ? new Date(s.lastWelcomePushAt).getTime() : 0)
    .reduce((max, v) => Math.max(max, v), 0)
  const customerLastWelcome = customer?.lastWelcomePushAt ? new Date(customer.lastWelcomePushAt).getTime() : 0
  const lastWelcomeMs = Math.max(customerLastWelcome, centralLastWelcome)
  const nowMs = Date.now()
  if (lastWelcomeMs && nowMs - lastWelcomeMs < DAY_MS) {
    return NextResponse.json({ sent: false, skipped: 'within_24h' })
  }

  let displayName = (customer?.name ?? '').trim()
  if (!displayName) {
    try {
      const clerk = await clerkClient()
      const user = await clerk.users.getUser(userId)
      displayName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.firstName || ''
    } catch {
      displayName = ''
    }
  }
  const { title, body } = getRandomCustomerWelcome(displayName)
  const payload = { title, body, url: '/', dir: 'rtl' as const }

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
        const result = await sendFCMToTokenDetailed(fcm, payload)
        if (result.ok) {
          sent = true
          delivered = true
        } else if (result.permanent) {
          cleanupPromises.push(removeDevice({ clerkUserId: userId, roleContext: 'customer', fcmToken: fcm }))
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
          cleanupPromises.push(removeDevice({ clerkUserId: userId, roleContext: 'customer', endpoint }))
        }
      }
    }
  }

  if (sent && customer?._id) {
    await writeClient.patch(customer._id).set({ lastWelcomePushAt: new Date(nowMs).toISOString() }).commit().catch(() => {})
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
