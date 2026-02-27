'use client'

/**
 * Browser-only: get FCM token for push notifications.
 * Pass the driver's service worker registration so FCM uses our custom SW (required when not using firebase-messaging-sw.js).
 */
import { getFirebaseConfig } from './firebase-config'

export async function getFCMToken(
  serviceWorkerRegistration?: ServiceWorkerRegistration
): Promise<{ token: string | null; error?: string }> {
  if (typeof window === 'undefined') return { token: null, error: 'Not in browser' }
  const config = getFirebaseConfig()
  if (!config) return { token: null, error: 'Firebase config or VAPID key missing in env' }
  try {
    const { getApp, getApps, initializeApp } = await import('firebase/app')
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging')
    const supported = await isSupported()
    if (!supported) return { token: null, error: 'Push not supported in this browser' }
    const app = getApps().length ? getApp() : initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    })
    const messaging = getMessaging(app)
    const options: { vapidKey: string; serviceWorkerRegistration?: ServiceWorkerRegistration } = {
      vapidKey: config.vapidKey,
    }
    if (serviceWorkerRegistration) options.serviceWorkerRegistration = serviceWorkerRegistration
    const token = await getToken(messaging, options)
    return { token: token ?? null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { token: null, error: msg }
  }
}
