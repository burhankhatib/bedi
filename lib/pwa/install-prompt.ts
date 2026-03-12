'use client'

/**
 * PWA Engine – Install Prompt Hook
 * Manages the beforeinstallprompt lifecycle and dismiss state.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PWAConfig, BeforeInstallPromptEvent, InstallPromptState, OSInfo } from './types'
import {
  STORAGE_KEY_INSTALL_PREFIX,
  DISMISS_HOURS_DEFAULT,
  DISMISS_HOURS_EXTENDED,
  SCROLL_THRESHOLD,
  AUTO_SHOW_DELAY_MS,
} from './constants'

function getDismissKey(role: string, slug?: string): string {
  return slug
    ? `${STORAGE_KEY_INSTALL_PREFIX}${role}-${slug}`
    : `${STORAGE_KEY_INSTALL_PREFIX}${role}`
}

export function useInstallPrompt(
  config: PWAConfig,
  os: OSInfo
): InstallPromptState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [showFallbackHint, setShowFallbackHint] = useState(false)
  const [dismissedUntilMs, setDismissedUntilMs] = useState<number | null>(null)
  const revealedRef = useRef(false)

  const dismissKey = getDismissKey(config.role, config.slug)

  // Load dismiss state from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(dismissKey)
      if (stored) {
        const ms = parseInt(stored, 10)
        if (!Number.isNaN(ms)) setDismissedUntilMs(ms)
      }
    } catch {
      // ignore
    }
  }, [dismissKey])

  // Listen for beforeinstallprompt (Android/Desktop Chromium)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (os.isStandalone) return

    const handler = (e: Event) => {
      try {
        ;(e as Event & { preventDefault?: () => void }).preventDefault?.()
        setDeferredPrompt(e as BeforeInstallPromptEvent)
        // On Android/Desktop, show prompt when native install is available
        if (!os.isIOS) {
          revealedRef.current = true
          setShowPrompt(true)
        }
      } catch {
        // avoid uncaught errors
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [os.isStandalone, os.isIOS])

  // Auto-reveal after scroll or timeout (especially for iOS which has no beforeinstallprompt)
  // Skip when hideAutoReveal (icon-only install UX)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (os.isStandalone) return
    if (config.hideAutoReveal) return

    const reveal = () => {
      if (revealedRef.current) return
      revealedRef.current = true
      setShowPrompt(true)
    }

    const onScroll = () => {
      if (window.scrollY > SCROLL_THRESHOLD) reveal()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    const timer = setTimeout(reveal, AUTO_SHOW_DELAY_MS)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [os.isStandalone, config.hideAutoReveal])

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) {
      setShowFallbackHint(true)
      setTimeout(() => setShowFallbackHint(false), 4500)
      return
    }
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowPrompt(false)
        setDeferredPrompt(null)
      }
    } catch {
      // PWA install can fail
    } finally {
      setInstalling(false)
    }
  }, [deferredPrompt])

  const dismissFor = useCallback(
    (hours: number) => {
      const until = Date.now() + hours * 60 * 60 * 1000
      setDismissedUntilMs(until)
      setShowPrompt(false)
      try {
        localStorage.setItem(dismissKey, String(until))
      } catch {
        // ignore
      }
    },
    [dismissKey]
  )

  const dismiss = useCallback(() => dismissFor(DISMISS_HOURS_DEFAULT), [dismissFor])
  const dismissExtended = useCallback(() => dismissFor(DISMISS_HOURS_EXTENDED), [dismissFor])

  // Compute final visibility
  const now = typeof window !== 'undefined' ? Date.now() : 0
  const dismissExpired = dismissedUntilMs === null || now >= dismissedUntilMs
  const canInstall = deferredPrompt !== null

  return {
    canInstall,
    showPrompt: !os.isStandalone && showPrompt && dismissExpired,
    dismissExpired,
    installing,
    triggerInstall,
    dismiss,
    dismissExtended,
    showFallbackHint,
  }
}
