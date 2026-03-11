'use client'

/**
 * PWA Engine – Main Hook
 * Composes all PWA utilities into a single hook for use in components.
 *
 * Usage:
 *   const pwa = usePWA(getDriverPWAConfig())
 *   // pwa.os, pwa.installPrompt, pwa.fcm, pwa.registration
 */

import { useState, useEffect } from 'react'
import type { PWAConfig, OSInfo } from './types'
import type { InstallPromptState } from './types'
import type { FCMState } from './types'
import { detectOS } from './detect'
import { registerServiceWorker, injectManifest } from './sw-registration'
import { useInstallPrompt } from './install-prompt'
import { useFCMSetup } from './fcm-setup'

export interface UsePWAResult {
  /** OS/platform detection */
  os: OSInfo
  /** Service worker registration (null until registered) */
  registration: ServiceWorkerRegistration | null
  /** Install prompt state and actions */
  installPrompt: InstallPromptState
  /** FCM push notification state and actions */
  fcm: FCMState
  /** The config used */
  config: PWAConfig
}

export function usePWA(config: PWAConfig): UsePWAResult {
  const [os, setOS] = useState<OSInfo>({
    isIOS: false,
    isAndroid: false,
    isDesktop: false,
    isStandalone: false,
  })
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  // Detect OS on mount
  useEffect(() => {
    setOS(detectOS())
  }, [])

  // Register SW and inject manifest on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Inject manifest (always)
    injectManifest(config.manifestUrl)

    // Register service worker (skip if no swUrl — e.g. customer-business role)
    if (config.swUrl) {
      registerServiceWorker(config).then((reg) => {
        if (reg) setRegistration(reg)
      })
    }
  }, [config.manifestUrl, config.swUrl, config.scope]) // eslint-disable-line react-hooks/exhaustive-deps

  // Compose hooks
  const installPrompt = useInstallPrompt(config, os)
  const fcm = useFCMSetup(config, registration, os)

  return {
    os,
    registration,
    installPrompt,
    fcm,
    config,
  }
}
