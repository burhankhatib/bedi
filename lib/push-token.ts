'use client'

import { Capacitor } from '@capacitor/core'

/**
 * Platform-agnostic helper to get a push notification token.
 * On native (Capacitor), uses the official @capacitor/push-notifications plugin.
 * On web, falls back to the Firebase JS SDK (getFCMToken).
 */
export async function getDevicePushToken(
  serviceWorkerRegistration?: ServiceWorkerRegistration
): Promise<{ token: string | null; error?: string }> {
  if (typeof window === 'undefined') return { token: null, error: 'Not in browser' }

  if (Capacitor.isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      
      // Request permission (Apple requires this to be explicit, Android 13+ as well)
      let permStatus = await PushNotifications.checkPermissions()
      
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions()
      }
      
      if (permStatus.receive !== 'granted') {
        return { token: null, error: 'User denied push permissions' }
      }
      
      // Register with Apple / Google to receive token
      await PushNotifications.register()
      
      // The actual token comes back in an event, we need to wait for it.
      // We'll wrap the listener in a Promise that resolves on success or timeout/error.
      return await new Promise((resolve) => {
        let isResolved = false
        let regListener: any = null
        let errListener: any = null
        
        const cleanup = () => {
          if (regListener) regListener.remove()
          if (errListener) errListener.remove()
        }
        
        // Timeout in case the token never arrives (e.g., bad config or emulator issues)
        const timeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true
            cleanup()
            resolve({ token: null, error: 'Native push token request timed out (is google-services.json correct?)' })
          }
        }, 10000)

        // Success listener
        PushNotifications.addListener('registration', (token) => {
          if (!isResolved) {
            isResolved = true
            clearTimeout(timeout)
            cleanup()
            // token.value is the APNs token on iOS or FCM token on Android.
            resolve({ token: token.value })
          }
        }).then(l => regListener = l)
        
        // Error listener
        PushNotifications.addListener('registrationError', (error) => {
          if (!isResolved) {
            isResolved = true
            clearTimeout(timeout)
            cleanup()
            resolve({ token: null, error: error.error || 'Failed to register for native push' })
          }
        }).then(l => errListener = l)
      })

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { token: null, error: msg }
    }
  }

  // Fallback to Web FCM
  const { getFCMToken } = await import('./firebase')
  return getFCMToken(serviceWorkerRegistration)
}
