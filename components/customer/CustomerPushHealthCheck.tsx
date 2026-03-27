'use client'

import { useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { getCustomerPushSubscriptionToken, syncCustomerTokenToServer } from '@/lib/customer-push-subscribe'
import { isFirebaseConfigured } from '@/lib/firebase-config'

async function getCurrentCustomerToken(): Promise<string> {
  if (typeof window === 'undefined') return ''
  if (typeof isFirebaseConfigured !== 'function' || !isFirebaseConfigured()) return ''
  
  // Quick check so we don't prompt in the background if they haven't granted
  const isNative = (window as any).Capacitor?.isNativePlatform()
  if (!isNative && typeof Notification !== 'undefined' && Notification.permission !== 'granted') return ''

  try {
    const { token } = await getCustomerPushSubscriptionToken(false)
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
    if (typeof window === 'undefined') return
    const isNative = (window as any).Capacitor?.isNativePlatform()
    if (!isNative && typeof Notification !== 'undefined' && Notification.permission !== 'granted') return

    let cancelled = false
    const HEALTH_CHECK_POST_THROTTLE_MS = 60 * 60 * 1000 // 1h between re-register attempts
    const HEALTH_CHECK_POST_KEY = 'bedi-customer-health-check-post-last'
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
          try {
            const last = Number(localStorage.getItem(HEALTH_CHECK_POST_KEY) || '0')
            if (Number.isFinite(last) && Date.now() - last < HEALTH_CHECK_POST_THROTTLE_MS) return
          } catch {
            /* ignore */
          }
          const res = await syncCustomerTokenToServer(token, { source: 'customer-health-check' })
          if (res) try { localStorage.setItem(HEALTH_CHECK_POST_KEY, String(Date.now())) } catch { /* ignore */ }
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

