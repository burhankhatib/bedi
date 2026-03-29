import { clerkClient } from '@clerk/nextjs/server'
import { clientNoCdn } from '@/sanity/lib/client'
import { SUPER_ADMIN_EMAIL } from '@/lib/constants'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'

/**
 * Send FCM (or Web Push) notification to the Super Admin only.
 * Used e.g. when a driver registers and is waiting for verification — only the Super Admin is notified.
 */
export async function sendAdminNotification(title: string, body: string, url: string = '/admin') {
  try {
    const clClient = await clerkClient()
    const users = await clClient.users.getUserList({ emailAddress: [SUPER_ADMIN_EMAIL] })
    const superAdminId = users.data[0]?.id

    if (!superAdminId) return false

    const subs = await clientNoCdn.fetch<
      { _id: string; fcmToken?: string; webPush?: any; devices?: Array<{ fcmToken?: string; pushClient?: string; webPush?: { endpoint?: string; p256dh?: string; auth?: string } }> }[]
    >(
      `*[_type == "userPushSubscription" && clerkUserId == $superAdminId && isActive != false]{ _id, fcmToken, "webPush": webPush, devices }`,
      { superAdminId }
    )

    if (!subs.length) return false

    const payload = { title, body, url }
    let sent = false

    for (const sub of subs) {
      const tokens: Array<{ token: string; pushClient?: string }> = []
      const webPushSubs: Array<{ endpoint: string; p256dh: string; auth: string }> = []

      if (sub.fcmToken) tokens.push({ token: sub.fcmToken })
      if (sub.webPush?.endpoint && sub.webPush?.p256dh && sub.webPush?.auth) {
        webPushSubs.push({
          endpoint: sub.webPush.endpoint,
          p256dh: sub.webPush.p256dh,
          auth: sub.webPush.auth,
        })
      }
      if (Array.isArray(sub.devices)) {
        for (const d of sub.devices) {
          if (d.fcmToken) tokens.push({ token: d.fcmToken, pushClient: d.pushClient })
          if (d.webPush?.endpoint && d.webPush?.p256dh && d.webPush?.auth) {
            webPushSubs.push({
              endpoint: d.webPush.endpoint,
              p256dh: d.webPush.p256dh,
              auth: d.webPush.auth,
            })
          }
        }
      }

      for (const { token, pushClient } of tokens) {
        const payloadWithClient = pushClient ? { ...payload, pushClient: pushClient as any } : payload
        if (isFCMConfigured() && (await sendFCMToToken(token, payloadWithClient))) sent = true
      }
      for (const wp of webPushSubs) {
        if (isPushConfigured()) {
          const ok = await sendPushNotification(
            { endpoint: wp.endpoint, keys: { p256dh: wp.p256dh, auth: wp.auth } },
            payload
          )
          if (ok) sent = true
        }
      }
    }

    return sent
  } catch (error) {
    console.error('[Admin Push] Failed to send admin notification:', error)
    return false
  }
}