'use client'

import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { FullPageLink } from '@/components/ui/FullPageLink'
import Image from 'next/image'
import { useLanguage } from '@/components/LanguageContext'
import { useCart } from '@/components/Cart/CartContext'
import { UtensilsCrossed, Store, ShoppingCart, Search, Package } from 'lucide-react'

const NAV_HEIGHT = 72
/** Extra padding so nav text is not flush with the screen bottom (M3 thumb-zone). */
const BOTTOM_PADDING = 'max(16px, env(safe-area-inset-bottom, 0px))'
/** Paths where the customer bottom nav is shown (home, search, tenant menu, order flow, my orders, track page). */
function isCustomerPath(pathname: string): boolean {
  if (!pathname) return false
  if (pathname === '/') return true
  if (pathname === '/search') return true
  if (pathname === '/my-orders') return true
  if (pathname === '/profile') return true
  if (pathname === '/my-questions') return true
  if (pathname.startsWith('/order')) return true
  if (pathname.startsWith('/resolve')) return true
  if (pathname.startsWith('/join')) return true
  if (/^\/t\/[^/]+\/?$/.test(pathname)) return true
  if (/^\/t\/[^/]+\/track\/[^/]+$/.test(pathname)) return true
  return false
}

/** Stable labels for initial render (avoids hydration mismatch with language from localStorage). */
const FALLBACK = {
  ariaLabel: 'Main navigation',
  home: 'Home',
  restaurants: 'Restaurants',
  stores: 'Stores',
  orders: 'Orders',
  cart: 'Cart',
  search: 'Search',
} as const

type NavIconKind = 'logo' | 'utensils' | 'store' | 'package' | 'search'

function NavGlyph({ kind }: { kind: NavIconKind }) {
  switch (kind) {
    case 'logo':
      return (
        <Image src="/logo.webp" alt="Bedi" width={28} height={28} className="h-7 w-7 object-contain" />
      )
    case 'utensils':
      return <UtensilsCrossed className="size-6" strokeWidth={2} />
    case 'store':
      return <Store className="size-6" strokeWidth={2} />
    case 'package':
      return <Package className="size-6" strokeWidth={2} />
    case 'search':
      return <Search className="size-6" strokeWidth={2} />
  }
}

const NavItem = memo(function NavItem({
  href,
  isButton,
  onClick,
  active,
  highlight,
  label,
  iconKind,
}: {
  href?: string
  isButton?: boolean
  onClick?: () => void
  active: boolean
  highlight?: boolean
  label: string
  iconKind: NavIconKind
}) {
  const content = (
    <>
      <span
        className={`relative flex h-10 w-10 items-center justify-center rounded-full ${active || highlight ? 'bg-amber-100 dark:bg-amber-950/50' : ''} ${highlight && !active ? 'animate-pulse' : ''}`}
      >
        <NavGlyph kind={iconKind} />
        {active && (
          <span
            className="absolute inset-0 rounded-full bg-amber-500/15"
            aria-hidden
          />
        )}
      </span>
      <span
        className={`text-[11px] font-medium ${active || highlight ? 'text-amber-700 dark:text-amber-400 opacity-100' : 'text-slate-500 dark:text-slate-400 opacity-80'}`}
      >
        {label}
      </span>
    </>
  )

  const baseClass = 'flex flex-col items-center justify-center gap-1 py-3 min-h-[48px] min-w-0 flex-1 touch-manipulation select-none rounded-xl active:bg-slate-100/60 dark:active:bg-slate-800/40 transition-colors'
  if (isButton && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={baseClass}
        aria-label={label}
      >
        {content}
      </button>
    )
  }
  return (
    <FullPageLink href={href!} className={baseClass} aria-current={active ? 'page' : undefined}>
      {content}
    </FullPageLink>
  )
})

/** Cart tab: memoized so quantity updates don’t force full icon-tree reconciliation for other tabs. */
const CartNavButton = memo(function CartNavButton({
  label,
  isRtl,
  mounted,
  totalItems,
  onOpen,
}: {
  label: string
  isRtl: boolean
  mounted: boolean
  totalItems: number
  onOpen: () => void
}) {
  const baseClass =
    'flex flex-col items-center justify-center gap-1 py-3 min-h-[48px] min-w-0 flex-1 touch-manipulation select-none rounded-xl active:bg-slate-100/60 dark:active:bg-slate-800/40 transition-colors'
  return (
    <button type="button" onClick={onOpen} className={baseClass} aria-label={label}>
      <span className="relative flex h-10 w-10 items-center justify-center rounded-full">
        <ShoppingCart className="size-6" strokeWidth={2} />
        {mounted && totalItems > 0 && (
          <span
            className={`absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-950 ${isRtl ? 'left-0 top-0' : 'right-0 top-0'}`}
          >
            {totalItems > 99 ? '99+' : totalItems}
          </span>
        )}
      </span>
      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 opacity-80">{label}</span>
    </button>
  )
})

export function MobileBottomNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t, lang } = useLanguage()
  const { totalItems, setIsOpen, isOpen: cartOpen } = useCart()
  const [mounted, setMounted] = useState(false)
  const [activeOrderCount, setActiveOrderCount] = useState(0)
  const isMountedRef = useRef(false)
  const activeCountAbortRef = useRef<AbortController | null>(null)

  const openCart = useCallback(() => setIsOpen(true), [setIsOpen])

  useEffect(() => {
    isMountedRef.current = true
    const id = requestAnimationFrame(() => setMounted(true))
    return () => {
      cancelAnimationFrame(id)
      isMountedRef.current = false
      activeCountAbortRef.current?.abort()
    }
  }, [])

  const fetchActiveCount = useCallback(() => {
    if (!isCustomerPath(pathname ?? '')) return
    activeCountAbortRef.current?.abort()
    const ac = new AbortController()
    activeCountAbortRef.current = ac
    fetch('/api/me/orders/active-count', {
      credentials: 'include',
      cache: 'no-store',
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (!isMountedRef.current || ac.signal.aborted) return
        setActiveOrderCount(typeof data?.count === 'number' ? data.count : 0)
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return
        if (!isMountedRef.current) return
        setActiveOrderCount(0)
      })
  }, [pathname])

  useEffect(() => {
    fetchActiveCount()
  }, [fetchActiveCount])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchActiveCount()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [fetchActiveCount])

  if (!isCustomerPath(pathname ?? '')) return null

  // Hide when cart/checkout modal is open so it doesn't cover Send Order button
  if (cartOpen) return null

  const category = searchParams?.get('category') ?? ''
  const homeActive = pathname === '/'
  const restaurantsActive = pathname === '/search' && category === 'restaurant'
  const ordersActive = pathname === '/my-orders'
  const searchActive = pathname === '/search'
  const storesActive = pathname === '/search' && category === 'stores'
  const ordersHighlight = activeOrderCount > 0 || (!!pathname && /^\/t\/[^/]+\/track\/[^/]+$/.test(pathname))

  const isRtl = mounted && lang === 'ar'
  const ariaLabel = mounted ? t('Main navigation', 'التنقل الرئيسي') : FALLBACK.ariaLabel
  const homeLabel = mounted ? t('Home', 'الرئيسية') : FALLBACK.home
  const restaurantsLabel = mounted ? t('Restaurants', 'مطاعم') : FALLBACK.restaurants
  const storesLabel = mounted ? t('Stores', 'متاجر') : FALLBACK.stores
  const ordersLabel = mounted ? t('Orders', 'طلباتي') : FALLBACK.orders
  const cartLabel = mounted ? t('Cart', 'السلة') : FALLBACK.cart
  const searchLabel = mounted ? t('Search', 'بحث') : FALLBACK.search

  return (
    <nav
      role="navigation"
      aria-label={ariaLabel}
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.3)]"
      style={{
        height: `calc(${NAV_HEIGHT}px + ${BOTTOM_PADDING})`,
        paddingBottom: BOTTOM_PADDING,
      }}
    >
      <div className="flex h-[72px] items-stretch justify-around gap-1 px-1" dir={isRtl ? 'rtl' : 'ltr'}>
        <div key="/">
          <NavItem href="/" active={homeActive} label={homeLabel} iconKind="logo" />
        </div>
        <div key="/search?category=restaurant">
          <NavItem
            href="/search?category=restaurant"
            active={restaurantsActive}
            label={restaurantsLabel}
            iconKind="utensils"
          />
        </div>
        <div key="/search?category=stores">
          <NavItem href="/search?category=stores" active={storesActive} label={storesLabel} iconKind="store" />
        </div>
        <div key="/my-orders">
          <NavItem
            href="/my-orders"
            active={ordersActive}
            highlight={ordersHighlight}
            label={ordersLabel}
            iconKind="package"
          />
        </div>

        <div key="cart">
          <CartNavButton
            label={cartLabel}
            isRtl={isRtl}
            mounted={mounted}
            totalItems={totalItems}
            onOpen={openCart}
          />
        </div>

        <div key="/search-expand">
          <NavItem
            href="/search?expand=1"
            active={searchActive && !restaurantsActive && !storesActive}
            label={searchLabel}
            iconKind="search"
          />
        </div>
      </div>
    </nav>
  )
}

export const MOBILE_NAV_HEIGHT = NAV_HEIGHT
