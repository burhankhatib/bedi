'use client'

import { Capacitor } from '@capacitor/core'
import { getDevicePushToken } from './push-token'

/**
 * Unified driver push subscription helper.
 * - On Native (Capacitor): Bypasses ServiceWorker checks, uses plugin permission flow.
 * - On Web (PWA/Browser): Requires ServiceWorker, uses Notification API permission flow.
 */
export async function getDriverPushSubscriptionToken(
  allowPrompt = true
): Promise<{ token: string | null; error?: string; permissionState: string; registration?: ServiceWorkerRegistration }> {
  if (typeof window === 'undefined') {
    return { token: null, error: 'Not in browser', permissionState: 'default' }
  }

  // 1. Native Capacitor Flow
  if (Capacitor.isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      let permStatus = await PushNotifications.checkPermissions()
      
      if (allowPrompt && permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions()
      }
      
      if (permStatus.receive !== 'granted') {
        return { 
          token: null, 
          error: 'User denied native push permissions', 
          permissionState: permStatus.receive 
        }
      }

      // getDevicePushToken handles the actual registration and token waiting logic natively
      const res = await getDevicePushToken()
      return { ...res, permissionState: 'granted' }

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { token: null, error: msg, permissionState: 'prompt' }
    }
  }

  // 2. Web / PWA Flow
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    return { token: null, error: 'Push not supported in this browser', permissionState: 'unsupported' }
  }

  let perm = Notification.permission
  if (perm === 'denied') {
    return { token: null, error: 'Push denied by user', permissionState: 'denied' }
  }

  if (allowPrompt && perm !== 'granted') {
    perm = await Notification.requestPermission()
  }

  if (perm !== 'granted') {
    return { token: null, error: 'Push not granted', permissionState: perm }
  }

  try {
    const registration = await navigator.serviceWorker.register('/driver-sw.js', { scope: '/driver/' })
    await (registration as unknown as { ready: Promise<ServiceWorkerRegistration> }).ready
    
    if (!registration) {
      return { token: null, error: 'Failed to get SW registration', permissionState: 'granted' }
    }

    const res = await getDevicePushToken(registration)
    return { ...res, permissionState: 'granted', registration }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { token: null, error: msg, permissionState: 'granted' }
  }
}
