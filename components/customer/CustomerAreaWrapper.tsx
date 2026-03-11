'use client'

import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import { MobileBottomNav } from './MobileBottomNav'
import { CartSlider } from '@/components/Cart/CartSlider'
import { PWAManager } from '@/components/pwa/PWAManager'
import { useLocation } from '@/components/LocationContext'

/** Paths where the customer bottom nav is shown (home, search, tenant menu, order flow, my orders). */
function isCustomerPath(pathname: string): boolean {
  if (!pathname) return false
  if (pathname === '/') return true
  if (pathname === '/search') return true
  if (pathname === '/my-orders') return true
  if (pathname.startsWith('/order')) return true
  if (pathname.startsWith('/resolve')) return true
  if (pathname.startsWith('/join')) return true
  if (/^\/t\/[^/]+$/.test(pathname)) return true
  return false
}

/**
 * Wraps (main) layout children: on customer paths adds bottom padding for the sticky mobile nav,
 * registers the single Customer PWA SW, shows install + push/location prompts, and CartSlider.
 */
export function CustomerAreaWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showNav = isCustomerPath(pathname ?? '')
  const { isChosen } = useLocation()
  const canRenderCustomerShell = showNav && isChosen

  return (
    <>
      {canRenderCustomerShell && (
        <PWAManager role="customer" variant="fixed" showPermissions />
      )}
      <div className={canRenderCustomerShell ? 'pb-20 md:pb-0' : ''}>
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
