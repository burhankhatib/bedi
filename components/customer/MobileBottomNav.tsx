'use client'

import { useState, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'motion/react'
import { useLanguage } from '@/components/LanguageContext'
import { useCart } from '@/components/Cart/CartContext'
import { UtensilsCrossed, Store, ShoppingCart, Search, Package } from 'lucide-react'

const NAV_HEIGHT = 72
/** Extra padding so nav text is not flush with the screen bottom (M3 thumb-zone). */
const BOTTOM_PADDING = 'max(16px, env(safe-area-inset-bottom, 0px))'

/** M3 Standard Easing — 200–300ms for UI feedback */
const M3_SPRING = { type: 'spring' as const, stiffness: 400, damping: 30 }

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

function NavItem({
  href,
  isButton,
  onClick,
  active,
  highlight,
  label,
  icon,
  isRtl,
}: {
  href?: string
  isButton?: boolean
  onClick?: () => void
  active: boolean
  highlight?: boolean
  label: string
  icon: React.ReactNode
  isRtl: boolean
}) {
  const content = (
    <>
      <motion.span
        className={`relative flex h-10 w-10 items-center justify-center rounded-full ${active || highlight ? 'bg-amber-100 dark:bg-amber-950/50' : ''} ${highlight && !active ? 'animate-pulse' : ''}`}
        whileTap={{ scale: 0.88 }}
        transition={M3_SPRING}
      >
        {icon}
        {active && (
          <motion.span
            layoutId="nav-indicator"
            className="absolute inset-0 rounded-full bg-amber-500/15"
            transition={M3_SPRING}
            style={{ originX: 0.5, originY: 0.5 }}
          />
        )}
      </motion.span>
      <motion.span
        animate={{ opacity: active || highlight ? 1 : 0.7 }}
        transition={{ duration: 0.2 }}
        className={`text-[11px] font-medium ${active || highlight ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}
      >
        {label}
      </motion.span>
    </>
  )

  const baseClass = 'flex flex-col items-center justify-center gap-1 py-2.5 min-w-0 flex-1 touch-manipulation select-none rounded-xl active:bg-slate-100/60 dark:active:bg-slate-800/40'
  if (isButton && onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        className={baseClass}
        aria-label={label}
        whileTap={{ scale: 0.98 }}
        transition={M3_SPRING}
      >
        {content}
      </motion.button>
    )
  }
  return (
    <Link href={href!} className={baseClass} aria-current={active ? 'page' : undefined}>
      {content}
    </Link>
  )
}

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

  const isRtl = mounted && lang === 'ar'
  const ariaLabel = mounted ? t('Main navigation', 'التنقل الرئيسي') : FALLBACK.ariaLabel
  const homeLabel = mounted ? t('Home', 'الرئيسية') : FALLBACK.home
  const restaurantsLabel = mounted ? t('Restaurants', 'مطاعم') : FALLBACK.restaurants
  const storesLabel = mounted ? t('Stores', 'متاجر') : FALLBACK.stores
  const ordersLabel = mounted ? t('Orders', 'طلباتي') : FALLBACK.orders
  const cartLabel = mounted ? t('Cart', 'السلة') : FALLBACK.cart
  const searchLabel = mounted ? t('Search', 'بحث') : FALLBACK.search

  const items = [
    { href: '/', active: homeActive, label: homeLabel, icon: <Image src="/logo.webp" alt="Bedi" width={28} height={28} className="h-7 w-7 object-contain" /> },
    { href: '/search?category=restaurant', active: restaurantsActive, label: restaurantsLabel, icon: <UtensilsCrossed className="size-6" strokeWidth={2} /> },
    { href: '/search?category=retail', active: storesActive, label: storesLabel, icon: <Store className="size-6" strokeWidth={2} /> },
    { href: '/my-orders', active: ordersActive, highlight: activeOrderCount > 0, label: ordersLabel, icon: <Package className="size-6" strokeWidth={2} /> },
  ]

  return (
    <motion.nav
      role="navigation"
      aria-label={ariaLabel}
      initial={false}
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.3)]"
      style={{
        height: `calc(${NAV_HEIGHT}px + ${BOTTOM_PADDING})`,
        paddingBottom: BOTTOM_PADDING,
      }}
    >
      <div className="flex h-[72px] items-stretch justify-around gap-1 px-1" dir={isRtl ? 'rtl' : 'ltr'}>
        {items.map((item, i) => (
          <motion.div key={item.href} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03, ...M3_SPRING }}>
            <NavItem href={item.href} active={item.active} highlight={item.highlight} label={item.label} icon={item.icon} isRtl={isRtl} />
          </motion.div>
        ))}

        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, ...M3_SPRING }}>
          <NavItem
            isButton
            onClick={() => setIsOpen(true)}
            active={false}
            label={cartLabel}
            icon={
              <span className="relative flex h-10 w-10 items-center justify-center">
                <ShoppingCart className="size-6" strokeWidth={2} />
                {mounted && totalItems > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-950 ${isRtl ? 'left-0 top-0' : 'right-0 top-0'}`}
                  >
                    {totalItems > 99 ? '99+' : totalItems}
                  </motion.span>
                )}
              </span>
            }
            isRtl={isRtl}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, ...M3_SPRING }}>
          <NavItem href="/search?expand=1" active={searchActive && !restaurantsActive && !storesActive} label={searchLabel} icon={<Search className="size-6" strokeWidth={2} />} isRtl={isRtl} />
        </motion.div>
      </div>
    </motion.nav>
  )
}

export const MOBILE_NAV_HEIGHT = NAV_HEIGHT
