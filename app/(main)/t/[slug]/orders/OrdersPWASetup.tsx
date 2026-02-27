'use client'

import { useEffect } from 'react'

/**
 * Registers the per-business Orders PWA SW (/t/[slug]/orders/sw.js, scope /t/[slug]/orders/)
 * so new-order FCM push works when the app is closed and the token is stored for this tenant only.
 */
export function OrdersPWASetup({ slug }: { slug: string }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !slug) return
    try {
      const scope = `/t/${slug}/orders/`
      navigator.serviceWorker.register(`/t/${slug}/orders/sw.js`, { scope }).catch(() => {})
    } catch {
      // avoid uncaught errors in PWA setup
    }
  }, [slug])
  return null
}
