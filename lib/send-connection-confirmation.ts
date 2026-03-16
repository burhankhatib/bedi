/**
 * Sends a funny "you're connected" FCM when user updates their push token.
 * Uses Palestine/Jordan dialect messages for drivers, tenants, and customers.
 */
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'
import { getRandomConnectionMessage } from '@/lib/push-connection-messages'

/**
 * Send a random funny connection confirmation push.
 * Call after successfully saving FCM token. Never throws.
 */
export async function sendConnectionConfirmationFcm(
  fcmToken: string,
  opts?: { url?: string }
): Promise<boolean> {
  if (!fcmToken?.trim() || !isFCMConfigured()) return false
  const msg = getRandomConnectionMessage()
  const url = opts?.url ?? '/'
  try {
    const ok = await sendFCMToToken(fcmToken, {
      title: msg.title,
      body: msg.body,
      url,
      dir: 'rtl',
    })
    return ok
  } catch {
    return false
  }
}
