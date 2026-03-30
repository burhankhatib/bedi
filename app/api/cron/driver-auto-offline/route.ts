import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'
import { getAutoOfflinePushAr } from '@/lib/driver-push-messages'
import { getActiveSubscriptionsForUser } from '@/lib/user-push-subscriptions'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

const AUTO_OFFLINE_AFTER_MS = 8 * 60 * 60 * 1000 // 8 hours

type DriverRow = {
  _id: string
  clerkUserId?: string
  nickname?: string
  fcmToken?: string
  pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
}

/**
 * GET (invoked by Vercel Cron every 15 min) — Find drivers who have been online for 8+ continuous hours,
 * set them offline in Sanity, and send each an FCM/Web Push announcement so they can open the app and go back online.
 * Secured with CRON_SECRET / FIREBASE_JOB_SECRET (same pattern as other crons).
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const m = authHeader?.match(/^Bearer\s+(.+)$/i)
  const bearer = m?.[1]?.trim() || ''
  const url = new URL(req.url)
  const secretParam = url.searchParams.get('secret')
  const allowedSecrets = [process.env.CRON_SECRET, process.env.FIREBASE_JOB_SECRET].filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  )
  if (allowedSecrets.length && !allowedSecrets.includes(bearer) && !(secretParam && allowedSecrets.includes(secretParam))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const cutoff = new Date(Date.now() - AUTO_OFFLINE_AFTER_MS).toISOString()
  const drivers = await writeClient.fetch<DriverRow[]>(
    `*[_type == "driver" && isOnline == true && defined(onlineSince) && onlineSince <= $cutoff]{
      _id, clerkUserId, nickname, fcmToken, "pushSubscription": pushSubscription,
      "activeDeliveries": count(*[_type == "order" && orderType == "delivery" && assignedDriver._ref == ^._id && status in ["preparing", "waiting_for_delivery", "driver_on_the_way", "out-for-delivery"]])
    }[activeDeliveries == 0]`,
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
      const clerkId = (driver.clerkUserId ?? '').trim()
      if (clerkId) {
        const subs = await getActiveSubscriptionsForUser({ clerkUserId: clerkId, roleContext: 'driver' })
        for (const sub of subs) {
          for (const dev of sub?.devices ?? []) {
            if (dev?.fcmToken && isFCMConfigured()) {
              const payloadWithClient = dev.pushClient ? { ...payload, pushClient: dev.pushClient } : payload
              if (await sendFCMToToken(dev.fcmToken, payloadWithClient)) {
                sent = true
                break
              }
            }
            if (
              dev?.webPush?.endpoint &&
              dev.webPush.p256dh &&
              dev.webPush.auth &&
              isPushConfigured() &&
              (await sendPushNotification(
                { endpoint: dev.webPush.endpoint, keys: { p256dh: dev.webPush.p256dh, auth: dev.webPush.auth } },
                payload
              ))
            ) {
              sent = true
              break
            }
          }
          if (sent) break
        }
      }
      if (!sent && driver.fcmToken && isFCMConfigured()) {
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
