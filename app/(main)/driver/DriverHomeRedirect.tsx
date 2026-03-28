'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { useLanguage } from '@/components/LanguageContext'
import { isStandaloneMode } from '@/lib/pwa/detect'

const FETCH_TIMEOUT_MS = 8000
const FALLBACK_REDIRECT_MS = 5000

/**
 * Used on /driver: redirect to profile if not yet complete, otherwise to orders.
 * Ensures new drivers land on profile first without briefly showing the Orders page.
 * Includes timeout and fallback hard redirect to avoid getting stuck on slow networks or PWA.
 */
export function DriverHomeRedirect() {
  const router = useRouter()
  const { t } = useLanguage()
  const hasRedirected = useRef(false)

  const hardRedirect = (path: string) => {
    if (hasRedirected.current || typeof window === 'undefined') return
    if (window.location.pathname === path) return
    hasRedirected.current = true
    window.location.href = path
  }

  useEffect(() => {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    const fallback = setTimeout(() => hardRedirect('/driver/profile'), FALLBACK_REDIRECT_MS)

    fetch('/api/driver/profile', { signal: ctrl.signal, credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        clearTimeout(timeout)
        clearTimeout(fallback)
        if (hasRedirected.current) return
        const target = data?._id ? '/driver/orders' : '/driver/profile'
        // Capacitor WebView: client router.replace often stalls after OAuth; hard navigation matches PWA standalone.
        if (isStandaloneMode() || Capacitor.isNativePlatform()) {
          hardRedirect(target)
          return
        }
        router.replace(target)
        setTimeout(() => hardRedirect(target), 2500)
      })
      .catch(() => {
        clearTimeout(timeout)
        clearTimeout(fallback)
        if (!hasRedirected.current) {
          const target = '/driver/profile'
          if (isStandaloneMode() || Capacitor.isNativePlatform()) {
            hardRedirect(target)
            return
          }
          router.replace(target)
          setTimeout(() => hardRedirect(target), 2500)
        }
      })

    return () => {
      clearTimeout(timeout)
      clearTimeout(fallback)
    }
  }, [router])
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
      <p>{t('Redirecting…', 'جاري التوجيه...')}</p>
    </div>
  )
}
