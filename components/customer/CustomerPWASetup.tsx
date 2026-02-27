'use client'

import { useEffect } from 'react'

/**
 * Registers the single Customer PWA service worker at scope / so the same app
 * is used for homepage, search, and all business pages. No per-business SW.
 */
export function CustomerPWASetup() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/customer-sw.js', { scope: '/' }).catch(() => {})
  }, [])
  return null
}
