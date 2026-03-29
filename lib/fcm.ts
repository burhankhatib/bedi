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
  /** When true, uses critical/interruption-level for urgent delivery (e.g. driver arrived) */
  critical?: boolean
  /** When true, send data-only (no notification block) so the service worker fully controls display and click. Use for customer PWA to fix Android tap-to-open. */
  dataOnly?: boolean
  /** Identifies the target platform to adjust link behavior (prevents Capacitor from opening browser) */
  pushClient?: 'native' | 'pwa' | 'browser'
}

/**
 * Send FCM to a token (web, Android, or iOS). Uses data payload so the service worker
 * receives the push event when app is closed/background. All notifications are sent
 * as HIGH PRIORITY: Android high/max, iOS time-sensitive, web high urgency — so
 * Business and Driver get new-order alerts immediately (same behaviour as Driver).
 */
function buildFullUrl(url: string): string {
  if (url.startsWith('http')) return url
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  if (!base) return url
  const seg = url.startsWith('/') ? url : `/${url}`
  return `${base}${seg}`
}

export async function sendFCMToTokenDetailed(
  token: string,
  payload: FcmPayload
): Promise<FcmSendResult> {
  const msg = getAdminMessaging()
  if (!msg) return { ok: false, permanent: false, reason: 'fcm_not_configured' }
  const rawUrl = payload.url ?? '/driver/orders'
  const fullUrl = buildFullUrl(rawUrl)
  
  // If native or auto (unknown), omit web link and use path-first for data.url
  const isNativeOrAuto = !payload.pushClient || payload.pushClient === 'native'
  let targetUrl = isNativeOrAuto ? rawUrl : fullUrl

  if (isNativeOrAuto && targetUrl.startsWith('http')) {
    try {
      const u = new URL(targetUrl)
      targetUrl = u.pathname + u.search
    } catch {
      // ignore
    }
  }

  const title = payload.title || 'Notification'
  const body = (payload.body ?? '').replace(/"/g, "'")
  const data: Record<string, string> = { title, body, url: targetUrl }
  if (payload.dir) data.dir = payload.dir
  if (payload.icon) data.icon = payload.icon
  if (payload.pushClient) data.pushClient = payload.pushClient
  if (payload.data && typeof payload.data === 'object') {
    for (const [k, v] of Object.entries(payload.data)) {
      if (typeof v === 'string') data[k] = v
    }
  }
  const isCritical = payload.critical === true
  const dataOnly = payload.dataOnly === true
  const apnsInterruption = isCritical ? ('critical' as const) : ('time-sensitive' as const)
  const androidChannel = isCritical ? 'driver_arrived_channel' : 'high_importance_channel'
  try {
    const message: Record<string, unknown> = {
      token,
      data,
      webpush: {
        headers: { Urgency: 'high' },
      },
    }
    if (!isNativeOrAuto) {
      ;(message.webpush as any).fcmOptions = { link: fullUrl }
    }
    if (!dataOnly) {
      message.notification = { title, body }
      message.android = {
        priority: 'high' as const,
        notification: {
          title,
          body,
          channelId: androidChannel,
          priority: 'max' as const,
          defaultSound: true,
          sound: 'default',
          defaultVibrateTimings: true,
          visibility: 'public' as const,
        },
      }
      message.apns = {
        headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
        payload: {
          aps: {
            alert: { title, body },
            sound: 'default',
            'interruption-level': apnsInterruption,
          },
        },
      }
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
  payload: { title: string; body?: string; url?: string; dir?: 'rtl' | 'ltr'; icon?: string; pushClient?: 'native' | 'pwa' | 'browser' }
): Promise<boolean> {
  const result = await sendFCMToTokenDetailed(token, payload)
  return result.ok
}
