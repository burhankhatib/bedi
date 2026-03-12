/**
 * Server-only: send push notifications via Firebase Cloud Messaging.
 * Loads credentials from:
 * 1. FIREBASE_SERVICE_ACCOUNT_PATH (path to JSON file), or
 * 2. bedi-delivery-firebase-adminsdk-*.json in project root, or
 * 3. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY in env.
 */
import path from 'path'
import fs from 'fs'

const SERVICE_ACCOUNT_FILENAME = 'bedi-delivery-firebase-adminsdk-fbsvc-9161982d29.json'

type MessagingLike = { send: (msg: unknown) => Promise<unknown> }
let messaging: MessagingLike | null = null

function getServiceAccountPath(): string | null {
  const envPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  if (envPath && fs.existsSync(envPath)) return envPath
  const rootPath = path.join(process.cwd(), SERVICE_ACCOUNT_FILENAME)
  if (fs.existsSync(rootPath)) return rootPath
  return null
}

function getAdminMessaging(): MessagingLike | null {
  if (messaging) return messaging
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initializeApp, getApps, cert } = require('firebase-admin/app')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getMessaging } = require('firebase-admin/messaging')
    if (getApps().length) {
      messaging = getMessaging()
      return messaging
    }
    const filePath = getServiceAccountPath()
    if (filePath) {
      const serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      initializeApp({ credential: cert(serviceAccount) })
      messaging = getMessaging()
      return messaging
    }
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
    if (projectId && clientEmail && privateKey) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      })
      messaging = getMessaging()
      return messaging
    }
  } catch {
    // ignore
  }
  return null
}

export function isFCMConfigured(): boolean {
  if (getServiceAccountPath()) return true
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  )
}

export type FcmSendResult = {
  ok: boolean
  permanent: boolean
  reason?: string
}

export type FcmPayload = {
  title: string
  body?: string
  url?: string
  dir?: 'rtl' | 'ltr'
  icon?: string
  /** Extra data fields merged into FCM data (e.g. driverArrived for customer order push) */
  data?: Record<string, string>
}

/**
 * Send FCM to a token (web, Android, or iOS). Uses data payload so the service worker
 * receives the push event when app is closed/background. All notifications are sent
 * as HIGH PRIORITY: Android high/max, iOS time-sensitive, web high urgency — so
 * Business and Driver get new-order alerts immediately (same behaviour as Driver).
 */
export async function sendFCMToTokenDetailed(
  token: string,
  payload: FcmPayload
): Promise<FcmSendResult> {
  const msg = getAdminMessaging()
  if (!msg) return { ok: false, permanent: false, reason: 'fcm_not_configured' }
  const url = payload.url ?? '/driver/orders'
  const title = payload.title || 'Notification'
  const body = (payload.body ?? '').replace(/"/g, "'")
  const data: Record<string, string> = { title, body, url }
  if (payload.dir) data.dir = payload.dir
  if (payload.icon) data.icon = payload.icon
  if (payload.data && typeof payload.data === 'object') {
    for (const [k, v] of Object.entries(payload.data)) {
      if (typeof v === 'string') data[k] = v
    }
  }
  try {
    const message = {
      token,
      data,
      notification: {
        title,
        body,
      },
      android: {
        priority: 'high' as const,
        notification: {
          title,
          body,
          channelId: 'high_importance_channel',
          priority: 'max' as const,
          defaultSound: true,
          sound: 'default',
          defaultVibrateTimings: true,
          visibility: 'public' as const,
        },
      },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert',
        },
        payload: {
          aps: {
            alert: { title, body },
            sound: 'default',
            'interruption-level': 'time-sensitive' as const,
          },
        },
      },
      webpush: {
        fcmOptions: {
          link: url.startsWith('http') ? url : undefined,
        },
        headers: {
          Urgency: 'high',
        },
      },
    }
    await msg.send(message)
    return { ok: true, permanent: false }
  } catch (e) {
    const raw = e as { code?: string; errorInfo?: { code?: string; message?: string }; message?: string; statusCode?: number }
    const errCode = raw?.errorInfo?.code || raw?.code || ''
    const msgText = raw?.errorInfo?.message || raw?.message || String(e)
    const statusCode = raw?.statusCode
    const isPermanent =
      errCode.includes('registration-token-not-registered') ||
      errCode.includes('invalid-registration-token') ||
      errCode.includes('invalid-argument') ||
      statusCode === 404
    if (process.env.NODE_ENV === 'development' || process.env.VERCEL) {
      console.error('[FCM] send failed:', msgText)
    }
    return { ok: false, permanent: isPermanent, reason: errCode || msgText }
  }
}

export async function sendFCMToToken(
  token: string,
  payload: { title: string; body?: string; url?: string; dir?: 'rtl' | 'ltr'; icon?: string }
): Promise<boolean> {
  const result = await sendFCMToTokenDetailed(token, payload)
  return result.ok
}
