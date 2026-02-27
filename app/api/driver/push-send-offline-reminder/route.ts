import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'
import { getOfflineReminderPushAr } from '@/lib/driver-push-messages'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** POST - Send one "you're offline" reminder push to the current driver (after 30s delay in PWA). New delivery requests are only sent to online drivers; this encourages going online to receive orders. Retries once if token not found (read-after-write). */
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let driver = await writeClient.fetch<{
    nickname?: string
    isOnline?: boolean
    fcmToken?: string
    pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
  } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ nickname, isOnline, fcmToken, "pushSubscription": pushSubscription }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
  if (driver.isOnline === true) return NextResponse.json({ sent: false, reason: 'already_online' })

  if (!driver.fcmToken && !driver.pushSubscription?.endpoint) {
    await new Promise((r) => setTimeout(r, 400))
    driver = await writeClient.fetch<{
      nickname?: string
      isOnline?: boolean
      fcmToken?: string
      pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
    } | null>(
      `*[_type == "driver" && clerkUserId == $userId][0]{ nickname, isOnline, fcmToken, "pushSubscription": pushSubscription }`,
      { userId }
    )
  }
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
  if (driver.isOnline === true) return NextResponse.json({ sent: false, reason: 'already_online' })

  const { title, body } = getOfflineReminderPushAr(driver.nickname)
  const payload = { title, body, url: '/driver/orders' }

  let sent = false
  if (driver.fcmToken && isFCMConfigured()) {
    sent = await sendFCMToToken(driver.fcmToken, payload)
  }
  if (!sent && driver.pushSubscription?.endpoint && driver.pushSubscription?.p256dh && driver.pushSubscription?.auth && isPushConfigured()) {
    sent = await sendPushNotification(
      {
        endpoint: driver.pushSubscription.endpoint,
        keys: { p256dh: driver.pushSubscription.p256dh, auth: driver.pushSubscription.auth },
      },
      payload
    )
  }

  return NextResponse.json({ sent })
}
