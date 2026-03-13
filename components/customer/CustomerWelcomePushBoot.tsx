'use client'

import { useEffect } from 'react'
import { useUser } from '@clerk/nextjs'

/**
 * Sends one random daily welcome push for signed-in customers.
 * Server enforces 24h cooldown, so this call is safe on every app visit.
 */
export function CustomerWelcomePushBoot() {
  const { isSignedIn } = useUser()

  useEffect(() => {
    if (!isSignedIn) return
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    try {
      const key = 'bedi-customer-welcome-last-ping'
      const last = Number(localStorage.getItem(key) || '0')
      if (Number.isFinite(last) && Date.now() - last < 6 * 60 * 60 * 1000) return
      localStorage.setItem(key, String(Date.now()))
    } catch {
      // ignore storage failures
    }
    fetch('/api/customer/push-send-welcome', { method: 'POST', credentials: 'include' }).catch(() => {})
  }, [isSignedIn])

  return null
}

