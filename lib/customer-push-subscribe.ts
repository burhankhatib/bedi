'use client'

import { Capacitor } from '@capacitor/core'
import { getDevicePushToken } from './push-token'

/**
 * Unified customer push subscription helper.
 * - On Native (Capacitor): Bypasses ServiceWorker checks, uses plugin permission flow.
 * - On Web (PWA/Browser): Requires ServiceWorker, uses Notification API permission flow.
 */
export async function getCustomerPushSubscriptionToken(
  allowPrompt = true
): Promise<{ token: string | null; error?: string; permissionState: string }> {
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
    let registration = await navigator.serviceWorker.getRegistration('/')
    if (!registration) {
      await navigator.serviceWorker.register('/customer-sw.js', { scope: '/' })
      registration = await navigator.serviceWorker.ready
    }
    
    if (!registration) {
      return { token: null, error: 'Failed to get SW registration', permissionState: 'granted' }
    }

    const res = await getDevicePushToken(registration)
    return { ...res, permissionState: 'granted' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { token: null, error: msg, permissionState: 'granted' }
  }
}

/**
 * Syncs the token to the standard customer push API.
 */
export async function syncCustomerTokenToServer(token: string, options?: { source?: string, tenantSlug?: string, isIOS?: boolean, standalone?: boolean }): Promise<boolean> {
  try {
    const res = await fetch('/api/customer/push-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        fcmToken: token,
        source: options?.source || 'customer-push-subscribe',
        tenantSlug: options?.tenantSlug,
        isIOS: options?.isIOS,
        standalone: options?.standalone,
      }),
    })
    return res.ok
  } catch (e) {
    console.error('Failed to sync customer push token:', e)
    return false
  }
}
