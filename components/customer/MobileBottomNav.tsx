'use client'

import { useState, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useLanguage } from '@/components/LanguageContext'
import { useCart } from '@/components/Cart/CartContext'
import { UtensilsCrossed, Store, ShoppingCart, Search, Package } from 'lucide-react'

const NAV_HEIGHT = 64
const SAFE_BOTTOM = 'env(safe-area-inset-bottom, 0px)'

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

export function MobileBottomNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t, lang } = useLanguage()
  const { totalItems, setIsOpen } = useCart()
  const [mounted, setMounted] = useState(false)
  const [activeOrderCount, setActiveOrderCount] = useState(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isCustomerPath(pathname ?? '')) return
    fetch('/api/me/orders/active-count', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setActiveOrderCount(typeof data?.count === 'number' ? data.count : 0))
      .catch(() => setActiveOrderCount(0))
  }, [pathname])

  if (!isCustomerPath(pathname ?? '')) return null

  const category = searchParams?.get('category') ?? ''
  const homeActive = pathname === '/'
  const restaurantsActive = pathname === '/search' && category === 'restaurant'
  const storesActive = pathname === '/search' && category === 'retail'
  const ordersActive = pathname === '/my-orders'
  const searchActive = pathname === '/search'

  const linkClass = (active: boolean) =>
    `flex flex-col items-center justify-center gap-1 py-2.5 min-w-0 flex-1 text-[11px] font-medium transition-colors touch-manipulation select-none ${
      active ? 'text-emerald-600' : 'text-slate-500 active:bg-slate-100/80 active:text-slate-700'
    }`

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
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-slate-200/90 bg-white/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
      style={{
        height: `calc(${NAV_HEIGHT}px + ${SAFE_BOTTOM})`,
        paddingBottom: SAFE_BOTTOM,
      }}
    >
      <div className="flex h-16 items-stretch justify-around gap-0" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Home */}
        <Link
          href="/"
          className={linkClass(homeActive)}
          aria-current={homeActive ? 'page' : undefined}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full transition-colors">
            <Image src="/logo.webp" alt="Bedi" width={28} height={28} className="h-7 w-7 object-contain" />
          </span>
          <span>{homeLabel}</span>
        </Link>

        {/* Restaurants */}
        <Link
          href="/search?category=restaurant"
          className={linkClass(restaurantsActive)}
          aria-current={restaurantsActive ? 'page' : undefined}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full transition-colors">
            <UtensilsCrossed className="size-6" strokeWidth={2} />
          </span>
          <span>{restaurantsLabel}</span>
        </Link>

        {/* Stores */}
        <Link
          href="/search?category=retail"
          className={linkClass(storesActive)}
          aria-current={storesActive ? 'page' : undefined}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full transition-colors">
            <Store className="size-6" strokeWidth={2} />
          </span>
          <span>{storesLabel}</span>
        </Link>

        {/* Orders — pulse + emerald when there are active orders */}
        <Link
          href="/my-orders"
          className={`${linkClass(ordersActive)} ${activeOrderCount > 0 ? 'text-emerald-600' : ''}`}
          aria-current={ordersActive ? 'page' : undefined}
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              activeOrderCount > 0 ? 'bg-emerald-100 text-emerald-600 animate-pulse' : ''
            }`}
          >
            <Package className="size-6" strokeWidth={2} />
          </span>
          <span>{ordersLabel}</span>
        </Link>

        {/* Cart */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`${linkClass(false)} relative`}
          aria-label={cartLabel}
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full transition-colors">
            <ShoppingCart className="size-6" strokeWidth={2} />
            {mounted && totalItems > 0 && (
              <span
                className={`absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white ${
                  isRtl ? 'left-0 top-0' : 'right-0 top-0'
                }`}
              >
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </span>
          <span>{cartLabel}</span>
        </button>

        {/* Search — expand=1 so filters are open by default when user taps Search */}
        <Link
          href="/search?expand=1"
          className={linkClass(searchActive && !restaurantsActive && !storesActive)}
          aria-current={searchActive ? 'page' : undefined}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full transition-colors">
            <Search className="size-6" strokeWidth={2} />
          </span>
          <span>{searchLabel}</span>
        </Link>
      </div>
    </nav>
  )
}

export const MOBILE_NAV_HEIGHT = NAV_HEIGHT
