'use client'

import { useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { getFCMToken } from '@/lib/firebase'
import { isFirebaseConfigured } from '@/lib/firebase-config'

async function getCurrentCustomerToken(): Promise<string> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return ''
  if (typeof isFirebaseConfigured !== 'function' || !isFirebaseConfigured()) return ''
  try {
    const reg =
      (await navigator.serviceWorker.getRegistration('/')) ??
      (await navigator.serviceWorker.getRegistration())
    if (!reg) return ''
    const { token } = await getFCMToken(reg)
    return token ?? ''
  } catch {
    return ''
  }
}

/**
 * Background self-heal for customer push:
 * - validates token with server
 * - re-registers if server says token missing
 */
export function CustomerPushHealthCheck() {
  const { isSignedIn } = useUser()

  useEffect(() => {
    if (!isSignedIn) return
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return

    let cancelled = false
    const check = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) return
      const token = await getCurrentCustomerToken()
      if (cancelled || !token) return
      try {
        const health = await fetch(`/api/customer/push-subscription?token=${encodeURIComponent(token)}`, {
          credentials: 'include',
        }).then((r) => r.json())
        if (cancelled) return
        if (health?.needsRefresh === true || health?.status === 'not_found') {
          await fetch('/api/customer/push-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ fcmToken: token, source: 'customer-health-check' }),
          })
        }
      } catch {
        // ignore transient failures
      }
    }

    check().catch(() => {})
    const onVisible = () => {
      if (document.visibilityState === 'visible') check().catch(() => {})
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible)
    }
    const timer = setInterval(() => {
      check().catch(() => {})
    }, 10 * 60 * 1000)

    return () => {
      cancelled = true
      clearInterval(timer)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible)
      }
    }
  }, [isSignedIn])

  return null
}

