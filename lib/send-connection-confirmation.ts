/**
 * Sends a funny "you're connected" push when user updates their push token.
 * Uses Palestine/Jordan dialect messages for drivers, tenants, and customers.
 * Tries FCM first; falls back to Web Push when FCM fails or is not configured.
 */
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { getRandomConnectionMessage } from '@/lib/push-connection-messages'

export type WebPushSubscription = {
  endpoint: string
  p256dh: string
  auth: string
}

const payloadForRole = (url: string) => {
  const msg = getRandomConnectionMessage()
  return {
    title: msg.title,
    body: msg.body,
    url,
    dir: 'rtl' as const,
  }
}

/**
 * Send a random funny connection confirmation push.
 * Tries FCM first; falls back to Web Push if FCM fails or is not configured.
 * Call after successfully saving push token. Never throws.
 */
export async function sendConnectionConfirmationFcm(
  fcmToken: string | null,
  opts?: { url?: string; webPush?: WebPushSubscription }
): Promise<boolean> {
  const url = opts?.url ?? '/'
  const payload = payloadForRole(url)

  if (fcmToken?.trim() && isFCMConfigured()) {
    try {
      const ok = await sendFCMToToken(fcmToken, payload)
      if (ok) return true
    } catch {
      // fall through to Web Push
    }
  }

  const wp = opts?.webPush
  if (wp?.endpoint && wp?.p256dh && wp?.auth && isPushConfigured()) {
    try {
      return await sendPushNotification(
        { endpoint: wp.endpoint, keys: { p256dh: wp.p256dh, auth: wp.auth } },
        payload
      )
    } catch {
      return false
    }
  }

  return false
}
