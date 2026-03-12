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

/** Paths where the Bedi Delivery PWA (scope /) should register. Includes all customer-facing pages — single PWA for homepage, search, business menus, track. */
function isCustomerPWAPath(pathname: string): boolean {
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

/**
 * Wraps (main) layout children: on customer paths adds bottom padding for the sticky mobile nav,
 * registers the Customer or per-business PWA, shows install + push/location prompts, and CartSlider.
 */
export function CustomerAreaWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showNav = isCustomerPath(pathname ?? '')
  const { isChosen } = useLocation()
  const canRenderCustomerShell = showNav && isChosen

  const isCustomerPWA = isCustomerPWAPath(pathname ?? '')

  return (
    <>
      {/* Bedi Delivery PWA — single app for all customer pages (homepage, search, business menus, track) */}
      {canRenderCustomerShell && isCustomerPWA && (
        <PWAManager key="pwa-customer" role="customer" variant="fixed" showPermissions hideInstall />
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

