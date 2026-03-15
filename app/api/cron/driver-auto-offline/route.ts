import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'
import { getAutoOfflinePushAr } from '@/lib/driver-push-messages'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

const AUTO_OFFLINE_AFTER_MS = 8 * 60 * 60 * 1000 // 8 hours

type DriverRow = {
  _id: string
  nickname?: string
  fcmToken?: string
  pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
}

/**
 * GET (invoked by Vercel Cron) — Find drivers who have been online for 8+ continuous hours,
 * set them offline in Sanity, and send each an FCM announcement so they can open the app and go back online.
 * Secured by CRON_SECRET: Vercel sends Authorization: Bearer $CRON_SECRET when CRON_SECRET is set.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const cutoff = new Date(Date.now() - AUTO_OFFLINE_AFTER_MS).toISOString()
  const drivers = await writeClient.fetch<DriverRow[]>(
    `*[_type == "driver" && isOnline == true && defined(onlineSince) && onlineSince <= $cutoff]{ _id, nickname, fcmToken, "pushSubscription": pushSubscription }`,
    { cutoff }
  )
  if (!drivers?.length) {
    return NextResponse.json({ ok: true, autoOfflinedCount: 0 })
  }

  let autoOfflinedCount = 0
  for (const driver of drivers) {
    try {
      await writeClient
        .patch(driver._id)
        .set({ isOnline: false, lastSeenAt: new Date().toISOString() })
        .unset(['onlineSince'])
        .commit()
      autoOfflinedCount += 1

      const { title, body } = getAutoOfflinePushAr(driver.nickname)
      const payload = { title, body, url: '/driver/orders' }
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
    } catch (e) {
      if (process.env.NODE_ENV === 'development' || process.env.VERCEL) {
        console.error('[cron/driver-auto-offline] Failed for driver', driver._id, e)
      }
    }
  }

  return NextResponse.json({ ok: true, autoOfflinedCount })
}
