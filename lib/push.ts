/**
 * CRITICAL: Web Push for Business (tenant) new-order and Driver delivery-request notifications.
 * Do not remove, refactor, or change env usage without testing push end-to-end.
 *
 * Requires: npm install web-push
 * Generate VAPID keys: npx web-push generate-vapid-keys
 * Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env.local (and production)
 */

export type PushSubscriptionPayload = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export type PushSendResult = {
  ok: boolean
  permanent: boolean
  reason?: string
}

let webpush: typeof import('web-push') | null = null
try {
  // serverExternalPackages in next.config. Loaded at runtime.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  webpush = require('web-push')
} catch {
  // web-push not installed or failed to load
}

const PUSH_LOG_PREFIX = '[Push]'

export function isPushConfigured(): boolean {
  if (!webpush) return false
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  return Boolean(publicKey && privateKey)
}

/** Normalize key to base64url (web-push expects URL-safe base64). Accepts standard base64 or base64url. */
function normalizeKey(key: string): string {
  if (!key || typeof key !== 'string') return key
  return key.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Send a Web Push notification. Used for both:
 * - Tenant (business): new order alerts
 * - Driver: new delivery request alerts
 */
export async function sendPushNotificationDetailed(
  subscription: PushSubscriptionPayload,
  payload: { title: string; body?: string; url?: string }
): Promise<PushSendResult> {
  if (!webpush || !isPushConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(PUSH_LOG_PREFIX, 'Push skipped: web-push not loaded or VAPID keys missing')
    }
    return { ok: false, permanent: false, reason: 'push_not_configured' }
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
  const privateKey = process.env.VAPID_PRIVATE_KEY!
  webpush.setVapidDetails('mailto:support@bedi.delivery', publicKey, privateKey)

  const p256dh = subscription.keys?.p256dh
  const auth = subscription.keys?.auth
  if (!p256dh || !auth) {
    console.error(PUSH_LOG_PREFIX, 'Invalid subscription: missing p256dh or auth')
    return { ok: false, permanent: true, reason: 'missing_subscription_keys' }
  }

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: normalizeKey(p256dh),
      auth: normalizeKey(auth),
    },
  }
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? '',
    url: payload.url ?? '/',
  })
  try {
    await webpush.sendNotification(pushSubscription, body)
    return { ok: true, permanent: false }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const code = err && typeof err === 'object' && 'statusCode' in err ? (err as { statusCode?: number }).statusCode : undefined
    console.error(PUSH_LOG_PREFIX, 'Send failed:', code ?? msg, subscription.endpoint?.slice(0, 50) + '...')
    const permanent = code === 404 || code === 410 || msg.includes('410') || msg.includes('404')
    if (code === 410 || msg.includes('410')) {
      console.warn(PUSH_LOG_PREFIX, 'Subscription expired (410 Gone). User must re-enable notifications.')
    }
    return { ok: false, permanent, reason: code ? String(code) : msg }
  }
}

export async function sendPushNotification(
  subscription: PushSubscriptionPayload,
  payload: { title: string; body?: string; url?: string }
): Promise<boolean> {
  const result = await sendPushNotificationDetailed(subscription, payload)
  return result.ok
}

/** @deprecated Use sendPushNotification. Kept for backward compatibility. */
export async function sendPushToDriver(
  subscription: PushSubscriptionPayload,
  payload: { title: string; body?: string; url?: string }
): Promise<boolean> {
  return sendPushNotification(subscription, payload)
}
