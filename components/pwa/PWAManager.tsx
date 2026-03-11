'use client'

/**
 * PWA Manager – Single Entry Point
 * The ONLY component you need to add to any layout/page.
 * Handles: SW registration, manifest injection, install prompt, update banner, permissions.
 *
 * Usage:
 *   <PWAManager role="driver" />
 *   <PWAManager role="business-orders" slug="kingbroast" businessName="King Broast" />
 *   <PWAManager role="customer" variant="fixed" />
 */

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { usePWA } from '@/lib/pwa/use-pwa'
import { getPWAConfig } from '@/lib/pwa/configs'
import type { PWARole } from '@/lib/pwa/types'
import { PWAInstallPrompt } from './PWAInstallPrompt'
import { PWAUpdateBanner } from './PWAUpdateBanner'
import { PWAPermissions } from './PWAPermissions'

interface PWAManagerProps {
  /** PWA role determines which app to install */
  role: PWARole
  /** Business slug (required for per-business roles) */
  slug?: string
  /** Business display name (optional, for per-business roles) */
  businessName?: string
  /** Business icon URL (optional, falls back to default) */
  businessIcon?: string
  /** Display variant: 'fixed' = floating bottom, 'inline' = embedded card */
  variant?: 'fixed' | 'inline'
  /** Enable permissions dialog (only for customer role in order flow) */
  showPermissions?: boolean
  /** Disable install prompt (useful when you only want update banner + FCM) */
  hideInstall?: boolean
}

export function PWAManager({
  role,
  slug,
  businessName,
  businessIcon,
  variant,
  showPermissions = false,
  hideInstall = false,
}: PWAManagerProps) {
  const pathname = usePathname()

  const config = useMemo(
    () => {
      const c = getPWAConfig(role, { slug, businessName, businessIcon })
      // Override variant if explicitly provided
      if (variant) c.variant = variant
      return c
    },
    [role, slug, businessName, businessIcon, variant]
  )

  const pwa = usePWA(config)

  // Determine if user is in an order flow (for permissions dialog)
  const inOrderFlow = Boolean(
    pathname && (pathname.startsWith('/order') || /^\/t\/[^/]+(\/|$)/.test(pathname))
  )

  return (
    <>
      {/* Update banner */}
      <PWAUpdateBanner config={config} registration={pwa.registration} />

      {/* Install prompt */}
      {!hideInstall && (
        <PWAInstallPrompt
          config={config}
          os={pwa.os}
          installPrompt={pwa.installPrompt}
          variant={config.variant || 'fixed'}
        />
      )}

      {/* Permissions dialog (customer role, standalone PWA, order flow) */}
      {showPermissions && (
        <PWAPermissions
          config={config}
          os={pwa.os}
          fcm={pwa.fcm}
          inOrderFlow={inOrderFlow}
        />
      )}
    </>
  )
}
