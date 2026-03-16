'use client'

import { Suspense, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { MobileBottomNav } from './MobileBottomNav'
import { CartSlider } from '@/components/Cart/CartSlider'
import { CartToast } from '@/components/Cart/CartToast'
import { PWAManager } from '@/components/pwa/PWAManager'
import { useLocation } from '@/components/LocationContext'
import { useCart } from '@/components/Cart/CartContext'
import { cn } from '@/lib/utils'
import { CustomerWelcomePushBoot } from '@/components/customer/CustomerWelcomePushBoot'
import { CustomerPushHealthCheck } from '@/components/customer/CustomerPushHealthCheck'
import { AiQuestionSyncOnLogin } from '@/components/customer/AiQuestionSyncOnLogin'
import { ChatFab } from '@/components/search/ChatFab'
import { CustomerPullToRefresh } from './CustomerPullToRefresh'
import { CustomerIOSPullToRefresh } from './CustomerIOSPullToRefresh'

/** Paths that should always load with scroll at top (e.g. when navigating from tenant menu). */
function useScrollToTopOnNavigate() {
  const pathname = usePathname()
  useEffect(() => {
    if (pathname === '/' || pathname?.startsWith('/search')) {
      window.scrollTo(0, 0)
    }
  }, [pathname])
}

/** Paths where the customer bottom nav is shown (home, search, tenant menu, order flow, my orders, track page). */
function isCustomerPath(pathname: string): boolean {
  if (!pathname) return false
  if (pathname === '/') return true
  if (pathname === '/search') return true
  if (pathname === '/my-orders') return true
  if (pathname === '/my-questions') return true
  if (pathname.startsWith('/order')) return true
  if (pathname.startsWith('/resolve')) return true
  if (pathname.startsWith('/join')) return true
  if (/^\/t\/[^/]+\/?$/.test(pathname)) return true
  if (/^\/t\/[^/]+\/track\/[^/]+$/.test(pathname)) return true
  return false
}

/** Paths that use Driver's own pull-to-refresh — skip Customer pull-to-refresh to avoid conflicts. */
function isDriverPath(pathname: string): boolean {
  return pathname?.startsWith?.('/driver') ?? false
}

/** Paths where the Bedi Delivery PWA (scope /) should register. Includes all customer-facing pages — single PWA for homepage, search, business menus, track. */
function isCustomerPWAPath(pathname: string): boolean {
  if (!pathname) return false
  if (pathname === '/') return true
  if (pathname === '/search') return true
  if (pathname === '/my-orders') return true
  if (pathname === '/my-questions') return true
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
  useScrollToTopOnNavigate()
  const showNav = isCustomerPath(pathname ?? '')
  const { isChosen } = useLocation()
  const { isOpen: cartOpen } = useCart()
  const canRenderCustomerShell = showNav && isChosen

  const isCustomerPWA = isCustomerPWAPath(pathname ?? '')
  const path = pathname ?? ''
  const showCustomerPullToRefresh = !isDriverPath(path)
  const isAuthOrVerifyPath = path.startsWith('/verify-phone') || path.startsWith('/sign-in') || path.startsWith('/sign-up')
  const showCustomerIOSPullToRefresh = !isDriverPath(path) && (isCustomerPWA || isAuthOrVerifyPath)

  const pageContent = (
    <>
      {/* Customer PWA pull-to-refresh (force reload on hard pull) — skip on driver which has its own */}
      {showCustomerPullToRefresh ? (
        <CustomerPullToRefresh>{children}</CustomerPullToRefresh>
      ) : (
        children
      )}
    </>
  )

  return (
    <>
      {/* iOS PWA: pulltorefreshjs for force reload when native is disabled */}
      {showCustomerIOSPullToRefresh && <CustomerIOSPullToRefresh />}
      {/* Bedi Delivery PWA — single app for all customer pages (homepage, search, business menus, track) */}
      {canRenderCustomerShell && isCustomerPWA && (
        <PWAManager key="pwa-customer" role="customer" variant="fixed" showPermissions hideInstall />
      )}
      {/* When cart is open: entire page goes behind cart (z-0) and is non-interactive. Only on customer paths where CartSlider is shown — avoid blocking auth/verify pages. */}
      <div className={cn(cartOpen && canRenderCustomerShell && 'relative z-0')}>
        <div className={cn(canRenderCustomerShell && 'pb-24 md:pb-0', cartOpen && canRenderCustomerShell && 'pointer-events-none')}>
          {pageContent}
        </div>
        <Suspense fallback={null}>
          {canRenderCustomerShell ? <MobileBottomNav /> : null}
        </Suspense>
      </div>
      {canRenderCustomerShell && (
        <>
          <AiQuestionSyncOnLogin />
          <CustomerPushHealthCheck />
          <CustomerWelcomePushBoot />
          <CartSlider supportsDineIn supportsReceiveInPerson />
          <CartToast />
          <ChatFab />
        </>
      )}
    </>
  )
}

