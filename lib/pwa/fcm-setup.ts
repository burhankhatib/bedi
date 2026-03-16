'use client'

/**
 * PWA Engine – FCM Setup Hook
 * Acquires FCM token using the active SW registration and registers it
 * via the role-appropriate push-subscription API endpoint.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import type { PWAConfig, FCMState, OSInfo } from './types'

export function useFCMSetup(
  config: PWAConfig,
  registration: ServiceWorkerRegistration | null,
  os: OSInfo
): FCMState {
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [loading, setLoading] = useState(false)
  const autoSyncedRef = useRef(false)

  // Sync permission state
  useEffect(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return
    setPermission(Notification.permission)
  }, [])

  const requestPush = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
      return false
    }

    // iOS non-standalone cannot do push
    if (os.isIOS && !os.isStandalone) return false

    // Already denied
    if (Notification.permission === 'denied') return false

    // No FCM endpoint configured
    if (!config.fcmEndpoint) return false

    setLoading(true)
    try {
      // Get or wait for registration
      let reg = registration
      if (!reg) {
        reg = await navigator.serviceWorker.getRegistration(config.scope) ?? null
        if (!reg) {
          const { registerServiceWorker } = await import('./sw-registration')
          reg = await registerServiceWorker(config)
        }
      }
      if (!reg) return false

      // Request permission if not already granted
      let perm: NotificationPermission = Notification.permission
      if (perm !== 'granted') {
        perm = await Notification.requestPermission()
      }
      setPermission(perm)
      if (perm !== 'granted') return false

      // Get FCM token
      const { isFirebaseConfigured } = await import('@/lib/firebase-config')
      if (!isFirebaseConfigured()) return false

      const { getFCMToken } = await import('@/lib/firebase')
      const { token } = await getFCMToken(reg)
      if (!token) return false

      // Register token with the role-specific API
      await fetch(config.fcmEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fcmToken: token,
          source: `pwa-${config.role}`,
          tenantSlug: config.slug || null,
          isIOS: os.isIOS,
          standalone: os.isStandalone,
        }),
      })

      return true
    } catch {
      return false
    } finally {
      setLoading(false)
    }
  }, [config, registration, os])

  // Auto-sync if permission is already granted (e.g. returning user).
  // Throttled to once per 24h to avoid POST on every page load/refresh (which would trigger FCM spam).
  const AUTO_SYNC_THROTTLE_MS = 24 * 60 * 60 * 1000
  const AUTO_SYNC_KEY = `bedi-fcm-autosync-${config.role}-${config.slug || 'default'}`

  useEffect(() => {
    if (autoSyncedRef.current) return
    if (!registration || !config.fcmEndpoint) return
    if (typeof window === 'undefined' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    try {
      const last = Number(localStorage.getItem(AUTO_SYNC_KEY) || '0')
      if (Number.isFinite(last) && Date.now() - last < AUTO_SYNC_THROTTLE_MS) return
    } catch {
      // storage can throw in private mode
    }
    autoSyncedRef.current = true
    void requestPush().then((ok) => {
      if (ok) try { localStorage.setItem(AUTO_SYNC_KEY, String(Date.now())) } catch { /* ignore */ }
    })
  }, [registration, config.fcmEndpoint, config.role, config.slug, requestPush])

  return { permission, loading, requestPush }
}
