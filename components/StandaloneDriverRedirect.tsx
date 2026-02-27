'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export const PREFER_DRIVER_KEY = 'bedi-prefer-driver'
export const PREFER_TENANT_KEY = 'bedi-prefer-tenant'

/**
 * When the app is opened as a PWA (standalone) at the root path (/), if the user
 * has a "prefer driver" flag (set when they visit any /driver page), redirect to
 * /driver so the Driver PWA icon opens the driver dashboard. Drivers are instructed
 * to add to Home Screen from the Orders page (/driver/orders) so the driver manifest
 * is used and the PWA opens at /driver; this redirect handles the case where they
 * opened the customer PWA instead.
 */
export function StandaloneDriverRedirect() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)
    if (!isStandalone || pathname !== '/') return
    try {
      if (localStorage.getItem(PREFER_DRIVER_KEY) === '1') {
        router.replace('/driver')
      }
    } catch {
      // ignore
    }
  }, [pathname, router])

  return null
}

/**
 * When the app is opened as a PWA (standalone) at the root path (/), if the user
 * has a "prefer tenant" flag (set when they visit /dashboard), redirect to
 * /dashboard so the Business PWA opens the tenant dashboard.
 * Runs only when PREFER_DRIVER_KEY is not set so driver preference takes precedence.
 */
export function StandaloneTenantRedirect() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)
    if (!isStandalone || pathname !== '/') return
    try {
      if (localStorage.getItem(PREFER_DRIVER_KEY) === '1') return
      if (localStorage.getItem(PREFER_TENANT_KEY) === '1') {
        router.replace('/dashboard')
      }
    } catch {
      // ignore
    }
  }, [pathname, router])

  return null
}
