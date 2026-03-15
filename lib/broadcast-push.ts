/**
 * Send a push notification to all active subscribers (customer, driver, tenant).
 * Used for daily morning message and other broadcasts.
 */
import { client } from '@/sanity/lib/client'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'

type SubDoc = {
  _id: string
  clerkUserId: string
  roleContext: string
  devices?: Array<{
    fcmToken?: string
    webPush?: { endpoint?: string; p256dh?: string; auth?: string }
  }>
}

export async function broadcastToAllSubscribers(payload: {
  title: string
  body: string
  url?: string
  dir?: 'rtl' | 'ltr'
}): Promise<{ sent: number; failed: number }> {
  const pushReady = isFCMConfigured() || isPushConfigured()
  if (!pushReady) return { sent: 0, failed: 0 }

  const url = payload.url ?? '/'
  const fullPayload = { ...payload, url }

  const subs = await client.fetch<SubDoc[]>(
    `*[_type == "userPushSubscription" && isActive != false && roleContext in ["customer", "driver", "tenant"]]{
      _id,
      clerkUserId,
      roleContext,
      devices
    }`
  )

  let sent = 0
  let failed = 0
  const seenTokens = new Set<string>()

  for (const sub of subs ?? []) {
    const devices = Array.isArray(sub.devices) ? sub.devices : []
    for (const dev of devices) {
      if (dev.fcmToken && isFCMConfigured()) {
        const key = `fcm:${dev.fcmToken}`
        if (!seenTokens.has(key)) {
          seenTokens.add(key)
          if (await sendFCMToToken(dev.fcmToken, fullPayload)) {
            sent++
          } else {
            failed++
          }
        }
      }
      if (dev.webPush?.endpoint && dev.webPush?.p256dh && dev.webPush?.auth && isPushConfigured()) {
        const key = `wp:${dev.webPush.endpoint}`
        if (!seenTokens.has(key)) {
          seenTokens.add(key)
          if (
            await sendPushNotification(
              { endpoint: dev.webPush!.endpoint!, keys: { p256dh: dev.webPush!.p256dh!, auth: dev.webPush!.auth! } },
              fullPayload
            )
          ) {
            sent++
          } else {
            failed++
          }
        }
      }
    }
  }

  return { sent, failed }
}
