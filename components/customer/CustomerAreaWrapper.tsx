'use client'

import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import { MobileBottomNav } from './MobileBottomNav'
import { CartSlider } from '@/components/Cart/CartSlider'
import { PWAManager } from '@/components/pwa/PWAManager'
import { useLocation } from '@/components/LocationContext'

/** Paths where the customer bottom nav is shown (home, search, tenant menu, order flow, my orders, track page). */
function isCustomerPath(pathname: string): boolean {
  if (!pathname) return false
  if (pathname === '/') return true
  if (pathname === '/search') return true
  if (pathname === '/my-orders') return true
  if (pathname.startsWith('/order')) return true
  if (pathname.startsWith('/resolve')) return true
  if (pathname.startsWith('/join')) return true
  if (/^\/t\/[^/]+\/?$/.test(pathname)) return true
  if (/^\/t\/[^/]+\/track\/[^/]+$/.test(pathname)) return true
  return false
}

/** Paths where the CUSTOMER PWA (scope /) should register. Excludes /t/[slug] since those get their own per-business PWA. */
function isCustomerPWAPath(pathname: string): boolean {
  if (!pathname) return false
  if (pathname === '/') return true
  if (pathname === '/search') return true
  if (pathname === '/my-orders') return true
  if (pathname.startsWith('/order')) return true
  if (pathname.startsWith('/resolve')) return true
  if (pathname.startsWith('/join')) return true
  return false
}

/** Extract slug from /t/[slug] paths */
function extractSlug(pathname: string): string | null {
  const match = pathname.match(/^\/t\/([^/]+)\/?$/)
  return match ? match[1] : null
}

/**
 * Wraps (main) layout children: on customer paths adds bottom padding for the sticky mobile nav,
 * registers the Customer or per-business PWA, shows install + push/location prompts, and CartSlider.
 */
export function CustomerAreaWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showNav = isCustomerPath(pathname ?? '')
  const { isChosen } = useLocation()
  const canRenderCustomerShell = showNav && isChosen

  // Determine which PWA to show
  const isCustomerPWA = isCustomerPWAPath(pathname ?? '')
  const slug = extractSlug(pathname ?? '')
  const isBusinessPage = !!slug
  const shouldRenderBusinessPWA = isBusinessPage

  return (
    <>
      {/* Main customer PWA on homepage/search/my-orders/orders */}
      {canRenderCustomerShell && isCustomerPWA && (
        <PWAManager key="pwa-customer" role="customer" variant="fixed" showPermissions />
      )}
      {/* Per-business customer PWA on /t/[slug] pages */}
      {shouldRenderBusinessPWA && (
        <PWAManager key={`pwa-biz-${slug}`} role="customer-business" slug={slug!} variant="fixed" showPermissions />
      )}
      <div className={canRenderCustomerShell ? 'pb-24 md:pb-0' : ''}>
        {children}
      </div>
      <Suspense fallback={null}>
        {canRenderCustomerShell ? <MobileBottomNav /> : null}
      </Suspense>
      {canRenderCustomerShell && (
        <CartSlider supportsDineIn supportsReceiveInPerson />
      )}
    </>
  )
}

