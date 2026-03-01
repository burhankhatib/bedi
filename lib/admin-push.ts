import { clerkClient } from '@clerk/nextjs/server'
import { clientNoCdn } from '@/sanity/lib/client'
import { SUPER_ADMIN_EMAIL } from '@/lib/constants'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'

export async function sendAdminNotification(title: string, body: string, url: string = '/admin') {
  try {
    const clClient = await clerkClient()
    const users = await clClient.users.getUserList({ emailAddress: [SUPER_ADMIN_EMAIL] })
    const superAdminId = users.data[0]?.id

    if (!superAdminId) return false

    const subs = await clientNoCdn.fetch<{ _id: string; fcmToken?: string; webPush?: any }[]>(
      `*[_type == "userPushSubscription" && clerkUserId == $superAdminId && isActive != false]{ _id, fcmToken, "webPush": webPush }`,
      { superAdminId }
    )

    if (!subs.length) return false

    const payload = { title, body, url }
    let sent = false

    for (const sub of subs) {
      let fcmSent = false
      if (sub.fcmToken && isFCMConfigured()) {
        fcmSent = await sendFCMToToken(sub.fcmToken, payload)
        if (fcmSent) sent = true
      }
      
      if (!fcmSent && sub.webPush?.endpoint && sub.webPush?.p256dh && sub.webPush?.auth && isPushConfigured()) {
        const ok = await sendPushNotification(
          { endpoint: sub.webPush.endpoint, keys: { p256dh: sub.webPush.p256dh, auth: sub.webPush.auth } },
          payload
        )
        if (ok) sent = true
      }
    }

    return sent
  } catch (error) {
    console.error('[Admin Push] Failed to send admin notification:', error)
    return false
  }
}