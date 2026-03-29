'use client'

import { useEffect, useRef } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useDriverPush } from './DriverPushContext'

/**
 * FCM check runs in background. Status and enable/refresh live in PushStatusCard at bottom.
 * This component triggers an automatic push subscription prompt on startup until the user allows/denies it.
 */
export function DriverPushSetup() {
  const { hasPush, checked, isDenied, needsIOSHomeScreen, subscribe, locationChecked } = useDriverPush()
  const attemptedRef = useRef(false)

  useEffect(() => {
    // Only attempt auto-prompt once the context is checked and location has been resolved
    if (!checked || !locationChecked || attemptedRef.current) return
    
    // Skip if already has push, is denied, or needs iOS home screen
    if (hasPush || isDenied || needsIOSHomeScreen) return

    let cleanupAppListener: any = null

    try {
      const isNative = Capacitor.isNativePlatform()
      if (isNative) {
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) subscribe().catch(() => {})
        }).then(l => cleanupAppListener = l)
      }
      attemptedRef.current = true

      // Slight delay to ensure UI is settled and doesn't overlap immediately with layout render
      const timer = setTimeout(() => {
        // subscribe runs the prompt flow
        subscribe().catch(() => {})
      }, 1500)
      
      return () => {
        clearTimeout(timer)
        if (cleanupAppListener) cleanupAppListener.remove()
      }
    } catch {
      // ignore
    }
  }, [checked, locationChecked, hasPush, isDenied, needsIOSHomeScreen, subscribe])

  return null
}
