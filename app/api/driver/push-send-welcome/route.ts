import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'
import { getWelcomePushAr } from '@/lib/driver-push-messages'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** POST - Send one welcome push to the current driver (Arabic, with nickname). Use fresh read so we see the FCM token just saved. Retries once after 500ms if token not found (read-after-write). */
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let driver = await writeClient.fetch<{
    nickname?: string
    fcmToken?: string
    pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
  } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ nickname, fcmToken, "pushSubscription": pushSubscription }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  // Retry once after short delay if token not saved yet (Sanity read-after-write)
  if (!driver.fcmToken && !driver.pushSubscription?.endpoint) {
    await new Promise((r) => setTimeout(r, 500))
    driver = await writeClient.fetch<{
      nickname?: string
      fcmToken?: string
      pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
    } | null>(
      `*[_type == "driver" && clerkUserId == $userId][0]{ nickname, fcmToken, "pushSubscription": pushSubscription }`,
      { userId }
    )
  }
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  const { title, body } = getWelcomePushAr(driver.nickname)
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
