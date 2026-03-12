'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { InitialData, Product } from '@/app/types/menu'
import { CategoryNav } from '@/components/Menu/CategoryNav'
import { MenuGrid } from '@/components/Menu/MenuGrid'
import { ProductCard } from './ProductCard'
import { PopularProductCard } from './PopularProductCard'
import { ProductModal } from '@/components/Menu/ProductModal'
import { MenuSearch } from '@/components/Menu/MenuSearch'
import { ViewSwitcher, ViewType } from '@/components/Menu/ViewSwitcher'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useLanguage } from '@/components/LanguageContext'
import { useCart } from '@/components/Cart/CartContext'
import { useOrderAuth } from '@/lib/useOrderAuth'
import { FirebaseClerkSync } from '@/components/FirebaseClerkSync'
import { CartToast } from '@/components/Cart/CartToast'
import { TableChoiceModal } from '@/components/Menu/TableChoiceModal'
import { motion, useScroll, useSpring } from 'framer-motion'
import { Star, Facebook, Instagram, Globe, MessageCircle, ShoppingCart, MapPin, Clock, Package, ShieldAlert, Menu, LogOut, Home, ClipboardList } from 'lucide-react'
import { getTodaysHours, isWithinHours, getNextOpening, formatCountdown, getTimeZoneForCountry, getNowInTimeZone, getTodayActiveOrNextShift } from '@/lib/business-hours'
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'
import { SHIMMER_PLACEHOLDER } from '@/lib/image-placeholder'
import { getSocialProfileUrl } from '@/lib/social-urls'
import { getWhatsAppUrl } from '@/lib/whatsapp'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  useClerk,
  useUser,
} from '@clerk/nextjs'
import { UserButtonWithSignOutUrl } from '@/components/Auth/UserButtonWithSignOutUrl'
import { CustomerSidebarActions } from '@/components/saas/CustomerSidebarActions'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface MenuLayoutProps {
  initialData: InitialData
  tenantSlug?: string | null
  /** When set (e.g. from ?table= in URL), lock Dine-in and pre-fill table at checkout */
  initialTableNumber?: string | null
}

const MOST_POPULAR_ID = 'most-popular'

/** Format "09:00" or "22:00" to "9:00 AM" / "10:00 PM" */
function formatTimeHM(hm: string, lang: string): string {
  if (!hm || !/^\d{1,2}:\d{2}$/.test(hm)) return hm
  const [h, m] = hm.split(':').map(Number)
  const h12 = h % 12 || 12
  const ampm = h < 12 ? (lang === 'ar' ? 'ص' : 'AM') : (lang === 'ar' ? 'م' : 'PM')
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Minutes since midnight for "HH:mm" */
function toMinutes(hm: string): number {
  if (!hm || !/^\d{1,2}:\d{2}$/.test(hm)) return -1
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

type NextOpening = import('@/lib/business-hours').NextOpening

function ClosedBanner({
  nextOpening,
  lang,
  t,
}: {
  nextOpening: NextOpening
  lang: string
  t: (en: string, ar: string) => string
}) {
  const [countdown, setCountdown] = useState('')
  const message = lang === 'ar' ? nextOpening.messageAr : nextOpening.messageEn
  const nextLabel = lang === 'ar' ? nextOpening.nextOpenLabelAr : nextOpening.nextOpenLabelEn

  useEffect(() => {
    if (!nextOpening.nextOpenAt) {
      setCountdown('')
      return
    }
    const update = () => setCountdown(formatCountdown(nextOpening.nextOpenAt!, lang))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [nextOpening.nextOpenAt, lang, nextOpening])

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full border-b border-amber-300/80 bg-gradient-to-b from-amber-100 to-amber-50/90 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-4xl mx-auto px-4 py-5 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 sm:gap-6">
          <div className="flex items-start sm:items-center gap-3 flex-1">
            <div className="rounded-full bg-amber-200/80 p-2.5 shrink-0">
              <Clock className="size-6 text-amber-800" />
            </div>
            <div>
              <p className="text-base sm:text-lg font-bold text-amber-900 leading-snug">
                {t("We're closed right now. You can still browse the menu.", 'نحن مغلقون حالياً. يمكنك تصفح القائمة.')}
              </p>
              <p className="mt-1 text-sm sm:text-base text-amber-800 font-medium">
                {message}
              </p>
            </div>
          </div>
          {nextOpening.nextOpenAt && countdown && (
            <div className="shrink-0 flex flex-col items-center sm:items-end gap-1">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                {nextLabel}
              </p>
              <motion.span
                key={countdown}
                initial={{ scale: 1.05 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center justify-center min-w-[5rem] rounded-xl bg-amber-200/90 px-4 py-2 text-lg font-black text-amber-900 tabular-nums"
              >
                {countdown}
              </motion.span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function MenuLayout({ initialData, tenantSlug, initialTableNumber }: MenuLayoutProps) {
  const { categories, popularProducts, restaurantInfo, aboutUs, storeName, supportsDineIn, supportsReceiveInPerson, hasDelivery, isManuallyClosed, deactivateUntil, locationLat, locationLng } = initialData
  const catalogOnlyBySettings = supportsDineIn === false && supportsReceiveInPerson === false && hasDelivery === false
  const catalogHidePrices = initialData.catalogHidePrices
  const orderTypeOptions = tenantSlug
    ? { supportsDineIn: supportsDineIn ?? true, supportsReceiveInPerson: supportsReceiveInPerson ?? true, hasDelivery: hasDelivery ?? false }
    : null
  const { totalItems, setIsOpen, setTenantSlug, setLockedTableNumber, clearCart } = useCart()
  const router = useRouter()
  const orderAuth = useOrderAuth()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { signOut } = useClerk()
  const { user } = useUser()
  const menuRedirectUrl = tenantSlug ? `/t/${tenantSlug}` : (pathname && pathname.startsWith('/t/') ? pathname : '/')
  useEffect(() => {
    setTenantSlug(tenantSlug ?? null)
    return () => setTenantSlug(null)
  }, [tenantSlug, setTenantSlug])
  useEffect(() => {
    if (tenantSlug && initialTableNumber) {
      setLockedTableNumber(initialTableNumber)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        if (url.searchParams.has('table')) {
          url.searchParams.delete('table')
          window.history.replaceState({}, '', url.pathname + url.search + url.hash)
        }
      }
      return () => setLockedTableNumber(null)
    }
    setLockedTableNumber(null)
  }, [tenantSlug, initialTableNumber, setLockedTableNumber])
  // After sign-in/sign-up from cart, return with openCart=1 so we reopen the cart
  useEffect(() => {
    if (searchParams.get('openCart') === '1') {
      setIsOpen(true)
      const u = new URL(window.location.href)
      u.searchParams.delete('openCart')
      window.history.replaceState({}, '', u.pathname + (u.search || '') + u.hash)
    }
  }, [searchParams, setIsOpen])
  const hasMostPopular = Boolean(popularProducts?.length)
  const [activeCategory, setActiveCategory] = useState<string | null>(() =>
    hasMostPopular ? MOST_POPULAR_ID : (categories.length > 0 ? categories[0]._id : null)
  )
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [activeLayoutPrefix, setActiveLayoutPrefix] = useState<string>('grid')
  const [isModalOpen, setIsModalOpen] = useState(false)
  // Initialize with default to match server render, preventing hydration mismatch
  const [viewType, setViewType] = useState<ViewType>('thumbnail')
  const [isHydrated, setIsHydrated] = useState(false)
  const [stickyBlockHeight, setStickyBlockHeight] = useState(140) // header + menu bar for scroll offset
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showBrowseHomeModal, setShowBrowseHomeModal] = useState(false)
  const [showTableChoiceModal, setShowTableChoiceModal] = useState(false)

  // Show table choice modal when landing with ?table= (dine-in QR)
  useEffect(() => {
    if (tenantSlug && initialTableNumber && typeof window !== 'undefined') {
      const key = `bedi-table-choice-seen-${tenantSlug}-${initialTableNumber}`
      if (sessionStorage.getItem(key) !== '1') {
        setShowTableChoiceModal(true)
      }
    }
  }, [tenantSlug, initialTableNumber])

  const handleTableChoiceViewMenu = () => {
    if (tenantSlug && initialTableNumber && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`bedi-table-choice-seen-${tenantSlug}-${initialTableNumber}`, '1')
      } catch {
        // ignore
      }
    }
    setShowTableChoiceModal(false)
  }

  useEffect(() => {
    // Defer all state updates to prevent hydration mismatch
    const timer = setTimeout(() => {
      setIsHydrated(true)
      if (typeof window !== 'undefined') {
        const savedView = localStorage.getItem('menuViewType') as ViewType | null
        if (savedView && ['thumbnail', 'list', 'horizontal', 'thumbnail-2col'].includes(savedView)) {
          setViewType(savedView)
        }
      }
    }, 0)
    return () => clearTimeout(timer)
    // Reading from localStorage in useEffect is a standard pattern - necessary here
     
  }, [])

  // Save view preference to localStorage when it changes
  const handleViewChange = (newView: ViewType) => {
    setViewType(newView)
    if (typeof window !== 'undefined') {
      localStorage.setItem('menuViewType', newView)
    }
  }
  const headerRef = useRef<HTMLElement>(null)
  const categoryNavRef = useRef<HTMLElement>(null)
  const stickyBlockRef = useRef<HTMLDivElement>(null)
  const { t, lang } = useLanguage()
  const localizedName = restaurantInfo && (restaurantInfo.name_en || restaurantInfo.name_ar)
    ? t(restaurantInfo.name_en ?? '', restaurantInfo.name_ar ?? '')
    : null
  const headerTitle = storeName || localizedName || t('Restaurant', 'المطعم')

  const businessTimeZone = getTimeZoneForCountry(initialData.businessCountry)
  const todaysHours = getTodaysHours(restaurantInfo?.openingHours, restaurantInfo?.customDateHours, businessTimeZone)
  const hasSchedule = restaurantInfo?.openingHours?.some((d) => d?.open || d?.close)
  // Catalog mode (no delivery, no dine-in, no in-person): show as Open 24/7; only manual close applies
  const isOpenBySchedule = catalogOnlyBySettings || !hasSchedule || isWithinHours(todaysHours, businessTimeZone)
  const effectiveClosed = Boolean(isManuallyClosed) || !isOpenBySchedule
  const catalogOnly = catalogOnlyBySettings || effectiveClosed
  const nextOpening = effectiveClosed
    ? getNextOpening(
        Boolean(isManuallyClosed),
        initialData.deactivateUntil ?? null,
        todaysHours,
        restaurantInfo?.openingHours ?? null,
        lang,
        businessTimeZone
      )
    : null
  const { nowMins } = getNowInTimeZone(businessTimeZone)
  const activeOrNextShift = getTodayActiveOrNextShift(todaysHours, nowMins)
  const openMins = activeOrNextShift?.open ? toMinutes(activeOrNextShift.open) : -1
  const closeMins = activeOrNextShift?.close ? toMinutes(activeOrNextShift.close) : -1
  const openingSoon = openMins >= 0 && nowMins < openMins && openMins - nowMins <= 30
  const closesSoon = closeMins >= 0 && nowMins < closeMins && closeMins - nowMins <= 30
  const hoursLabel =
    catalogOnlyBySettings && !effectiveClosed
      ? t('Open 24/7', 'مفتوح 24 ساعة')
      : activeOrNextShift?.open || activeOrNextShift?.close
        ? (() => {
            const openF = formatTimeHM(activeOrNextShift.open ?? '', lang)
            const closeF = formatTimeHM(activeOrNextShift.close ?? '', lang)
            if (effectiveClosed) {
              if (isManuallyClosed) return t('Closed temporarily', 'مغلق مؤقتاً')
              if (nowMins < openMins) return `${t('Closed', 'مغلق')} · ${t('Opens', 'يفتح')} ${openF}`
              return `${t('Closed', 'مغلق')} · ${t('Opens tomorrow at', 'يفتح غداً الساعة')} ${openF}`
            }
            if (openingSoon) return `${t('Opens', 'يفتح')} ${openF} (${t('Opening Soon', 'يفتح قريباً')})`
            if (closesSoon) return `${t('Closes', 'يغلق')} ${closeF} (${t('Closes Soon', 'يغلق قريباً')})`
            return `${t('Open today', 'مفتوح اليوم')} ${openF} – ${closeF}`
          })()
        : effectiveClosed
          ? (isManuallyClosed ? t('Closed temporarily', 'مغلق مؤقتاً') : t('Closed', 'مغلق'))
          : null

  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  })

  // Measure sticky block height for scroll spy and scroll-into-view offset
  useEffect(() => {
    const updateHeight = () => {
      if (stickyBlockRef.current) setStickyBlockHeight(stickyBlockRef.current.offsetHeight)
    }
    updateHeight()
    const ro = new ResizeObserver(updateHeight)
    if (stickyBlockRef.current) ro.observe(stickyBlockRef.current)
    window.addEventListener('resize', updateHeight)
    const t = setTimeout(updateHeight, 150)
    return () => { ro.disconnect(); window.removeEventListener('resize', updateHeight); clearTimeout(t) }
  }, [restaurantInfo, lang, categories])

  // Scroll spy: update active nav item based on which section is in view
  useEffect(() => {
    const sectionIds: string[] = hasMostPopular ? [MOST_POPULAR_ID] : []
    categories.forEach((cat) => sectionIds.push(cat._id))

    const getScrollOffset = () => stickyBlockHeight + 24

    const onScroll = () => {
      const offset = getScrollOffset()
      let current: string | null = null
      for (const id of sectionIds) {
        const el = document.getElementById(id)
        if (el) {
          const top = el.getBoundingClientRect().top
          if (top <= offset) current = id
        }
      }
      if (current !== null) setActiveCategory((prev) => (prev === current ? prev : current))
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [hasMostPopular, categories, stickyBlockHeight])

  const handleCategoryClick = (id: string) => {
    setActiveCategory(id)
    const element = document.getElementById(id)
    if (element) {
      const totalOffset = stickyBlockHeight + 8
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
      const offsetPosition = elementPosition - totalOffset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
  }

  const handleProductClick = (product: Product, prefix: string = 'grid') => {
    setSelectedProduct(product)
    setActiveLayoutPrefix(prefix)
    setIsModalOpen(true)
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <FirebaseClerkSync />
      {/* Progress Bar — below mobile safe area (notch/status bar) */}
      <motion.div
        className="fixed left-0 right-0 h-1 bg-black z-50 origin-left"
        style={{ top: 'env(safe-area-inset-top, 0px)', scaleX }}
      />

      {/* Fixed header + menu bar — always visible when scrolling. Spacer reserves layout space. */}
      <div
        ref={stickyBlockRef}
        className="fixed top-0 left-0 right-0 z-40 bg-white shadow-md"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <header
          ref={headerRef}
          className="border-b border-slate-100 px-4 sm:px-5 md:px-6 py-3 sm:py-3.5"
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Logo — more breathing room */}
              <div className="flex items-center gap-3 shrink-0 min-w-0">
                {restaurantInfo?.logo && (
                  <div className="relative w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0">
                    <Image
                      src={urlFor(restaurantInfo.logo).width(100).height(100).url()}
                      alt={headerTitle}
                      fill
                      sizes="44px"
                      loading="eager"
                      priority
                      className="object-contain"
                    />
                  </div>
                )}
                <div className="hidden md:block min-w-0">
                  <h1 className="text-lg font-black tracking-tighter uppercase leading-tight truncate">
                    {headerTitle}
                  </h1>
                  {hoursLabel && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-500">
                      <Clock className="size-3.5 shrink-0" />
                      {hoursLabel}
                    </p>
                  )}
                </div>
              </div>

              {/* Search — flex-1 so it uses remaining space */}
              <div className="flex-1 min-w-0">
                <MenuSearch
                  categories={categories}
                  popularProducts={popularProducts}
                  onProductClick={handleProductClick}
                  restaurantLogo={restaurantInfo?.logo}
                />
              </div>

              {/* Desktop: Track order (this business), My orders (global), Browse more, Language, Auth. Mobile: hamburger only */}
              <div className="hidden md:flex items-center gap-2 shrink-0">
                {tenantSlug && (
                  <Link
                    href={`/t/${tenantSlug}/track`}
                    className="inline-flex items-center gap-1.5 rounded-full h-9 px-3 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium"
                    title={t('Track your order', 'تتبع طلبك')}
                  >
                    <Package className="w-5 h-5 shrink-0" />
                    {t('Track order', 'تتبع الطلب')}
                  </Link>
                )}
                <Link
                  href="/my-orders"
                  className="inline-flex items-center gap-1.5 rounded-full h-9 px-3 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium"
                  title={t('My orders from all businesses', 'طلباتي من جميع المتاجر')}
                >
                  <ClipboardList className="w-5 h-5 shrink-0" />
                  {t('My orders', 'طلباتي')}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (totalItems > 0) {
                      setShowBrowseHomeModal(true)
                    } else {
                      router.push('/')
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full h-9 px-3 text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-sm font-medium transition-colors"
                  title={t('Browse other businesses', 'استعرض أعمال أخرى')}
                >
                  <Home className="w-4 h-4 shrink-0 opacity-80" />
                  <span className="hidden lg:inline">{t('Browse more', 'استعرض المزيد')}</span>
                </button>
                <LanguageSwitcher />
                <SignedOut>
                  <SignInButton mode="modal" forceRedirectUrl={menuRedirectUrl} signUpForceRedirectUrl={menuRedirectUrl} />
                  <SignUpButton mode="modal" forceRedirectUrl={menuRedirectUrl} signInForceRedirectUrl={menuRedirectUrl} />
                </SignedOut>
                <SignedIn>
                  <UserButtonWithSignOutUrl />
                </SignedIn>
              </div>

              {/* Mobile: hamburger menu (Language, Track order, Sign in/up, Profile) */}
              <div className="md:hidden shrink-0">
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full h-10 w-10 text-slate-600 hover:bg-slate-100"
                      aria-label={t('Menu', 'القائمة')}
                    >
                      <Menu className="w-6 h-6" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[min(320px,90vw)] flex flex-col gap-6 pt-14">
                    <SheetHeader className="text-start px-2">
                      <SheetTitle>{headerTitle}</SheetTitle>
                    </SheetHeader>
                    <nav className="flex flex-1 flex-col gap-1 px-2">
                      {tenantSlug && (
                        <SheetClose asChild>
                          <Link
                            href={`/t/${tenantSlug}/track`}
                            className="flex items-center gap-3 rounded-lg py-3 px-3 text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <Package className="w-5 h-5 text-slate-500" />
                            {t('Track order', 'تتبع الطلب')}
                          </Link>
                        </SheetClose>
                      )}
                      <SheetClose asChild>
                        <Link
                          href="/my-orders"
                          className="flex items-center gap-3 rounded-lg py-3 px-3 text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <ClipboardList className="w-5 h-5 text-slate-500" />
                          {t('My orders', 'طلباتي')}
                        </Link>
                      </SheetClose>
                      <div className="flex items-center gap-3 rounded-lg py-3 px-3">
                        <LanguageSwitcher />
                      </div>
                      <div className="rounded-lg py-2">
                        <SignedOut>
                          <SignInButton mode="modal" forceRedirectUrl={menuRedirectUrl} signUpForceRedirectUrl={menuRedirectUrl}>
                            <button className="flex w-full items-center gap-3 rounded-lg py-3 px-3 text-slate-700 hover:bg-slate-100 transition-colors text-left">
                              {t('Sign in', 'تسجيل الدخول')}
                            </button>
                          </SignInButton>
                          <SignUpButton mode="modal" forceRedirectUrl={menuRedirectUrl} signInForceRedirectUrl={menuRedirectUrl}>
                            <button className="flex w-full items-center gap-3 rounded-lg py-3 px-3 text-slate-700 hover:bg-slate-100 transition-colors text-left mt-1">
                              {t('Sign up', 'إنشاء حساب')}
                            </button>
                          </SignUpButton>
                        </SignedOut>
                        <SignedIn>
                          <div className="rounded-lg py-2 px-3 flex flex-col gap-1">
                            {user?.imageUrl && (
                              <div className="flex items-center gap-3 py-2 px-1">
                                <img src={user.imageUrl} alt="" className="size-9 rounded-full object-cover" width={36} height={36} />
                                <span className="text-sm font-medium text-slate-700 truncate">{user.fullName || user.primaryEmailAddress?.emailAddress || t('Account', 'الحساب')}</span>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => signOut({ redirectUrl: '/' })}
                              className="flex w-full items-center gap-3 rounded-lg py-3 px-3 text-slate-700 hover:bg-slate-100 transition-colors text-left"
                            >
                              <LogOut className="w-5 h-5 shrink-0 text-slate-500" />
                              {t('Sign out', 'تسجيل الخروج')}
                            </button>
                          </div>
                        </SignedIn>
                      </div>
                      <div className="-mx-2">
                        <CustomerSidebarActions />
                      </div>
                    </nav>
                    <div className="mt-auto border-t border-slate-200 pt-4 px-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false)
                          if (totalItems > 0) {
                            setShowBrowseHomeModal(true)
                          } else {
                            router.push('/')
                          }
                        }}
                        className="flex w-full items-center gap-3 rounded-lg py-3 px-3 text-primary hover:bg-primary/10 transition-colors font-semibold"
                      >
                        <Home className="w-5 h-5 shrink-0" />
                        {t('Browse other businesses', 'استعرض أعمال أخرى')}
                      </button>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
            {hoursLabel && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-500 md:hidden">
                <Clock className="size-3.5 shrink-0" />
                {hoursLabel}
              </div>
            )}
          </div>
        </header>

        {/* Menu bar: categories + cart — always visible */}
        <div className="flex items-center border-b border-slate-100 bg-white/98 backdrop-blur-sm">
          <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar pl-4 pr-2">
            <CategoryNav
              ref={categoryNavRef}
              categories={categories}
              activeCategory={activeCategory}
              onCategoryClick={handleCategoryClick}
              showMostPopular={Boolean(popularProducts?.length)}
              embedded
            />
          </div>
          {/* Cart in menu bar: hidden on mobile — bottom nav has cart there */}
          {!catalogOnly && (
            <div className="hidden md:flex shrink-0 items-center pr-3 pl-2 py-2 border-l border-slate-100 bg-white">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsOpen(true)}
                className="relative rounded-full h-10 w-10 border-slate-200 shadow-sm hover:bg-slate-50"
                aria-label={t('Cart', 'السلة')}
              >
                <ShoppingCart className="w-5 h-5 text-slate-700" />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full min-w-[1.25rem] h-5 px-1 flex items-center justify-center">
                    {totalItems > 99 ? '99+' : totalItems}
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Spacer so page content starts below the fixed header + menu bar */}
      <div style={{ height: stickyBlockHeight }} aria-hidden />

      {/* Closed banner: clear notice when business is closed + when we open again (catalog only, no ordering) */}
      {effectiveClosed && nextOpening && (
        <ClosedBanner nextOpening={nextOpening} lang={lang} t={t} />
      )}

      {/* Personal Shopper info banner — store supports driver collecting items (e.g. supermarkets) */}
      {initialData.requiresPersonalShopper && (
        <div
          className="w-full border-b border-sky-200 bg-gradient-to-r from-sky-50 to-amber-50/80 px-4 py-4"
          role="status"
          aria-live="polite"
        >
          <div className="max-w-4xl mx-auto flex items-start gap-3">
            <span className="text-2xl shrink-0" aria-hidden>🛒</span>
            <div>
              <p className="text-base font-bold text-slate-800 leading-snug">
                {t(
                  `This store supports Personal Shopping: our driver will collect your items carefully for an additional ${initialData.shopperFee ?? 10} ILS.`,
                  `هذا المتجر يدعم خدمة التسوق الشخصي: سيقوم السائق بجمع الأغراض لك بعناية مقابل ${initialData.shopperFee ?? 10} شيكل إضافية.`
                )}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {t('Time-saving service — you order, we shop.', 'خدمة توفير وقتك — أنت تطلب، نحن نتسوق.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Order auth: sign in + verified phone required to place orders */}
      {!catalogOnly && orderAuth.isLoaded && (orderAuth.needsSignIn || orderAuth.needsPhoneVerification) && (
        <div className="flex w-full items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center" role="status">
          <ShieldAlert className="size-4 shrink-0 text-amber-700" />
          <p className="text-xs font-medium text-amber-900">
            {orderAuth.needsSignIn
              ? t('Sign in and verify your phone to place an order. Orders from unverified numbers are not accepted.', 'سجّل الدخول وثبّت رقم هاتفك لوضع الطلب. الطلبات من أرقام غير موثّقة لا تُقبل.')
              : t('Verify your phone to place an order. Orders from unverified numbers are not accepted.', 'ثبّت رقم هاتفك لوضع الطلب. الطلبات من أرقام غير موثّقة لا تُقبل.')}
          </p>
        </div>
      )}

      {/* Hero / Info */}
      {/* <section className="bg-white px-4 py-8 mb-4 border-b border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-4 items-center overflow-x-auto no-scrollbar pb-2">
            <div className="bg-slate-100 px-4 py-2 rounded-2xl whitespace-nowrap text-sm font-semibold">
              ⭐ 4.9 (500+ Reviews)
            </div>
            <div className="bg-slate-100 px-4 py-2 rounded-2xl whitespace-nowrap text-sm font-semibold">
              🕒 15-25 min
            </div>
            <div className="bg-slate-100 px-4 py-2 rounded-2xl whitespace-nowrap text-sm font-semibold">
              📍 Istanbul, TR
            </div>
          </div>
        </div>
      </section> */}

      {/* Popular Items Section */}
      {popularProducts && popularProducts.length > 0 && (
        <section id="most-popular" key={`popular-${lang}`} className="max-w-7xl mx-auto py-8 px-4 overflow-hidden relative">
          <div className="flex items-center gap-2 mb-6">
            <Star className="w-5 h-5 text-amber-400 fill-current" />
            <h2 className="text-xl font-black uppercase tracking-tight">
              {t('Most Popular', 'الأكثر طلباً')}
            </h2>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6 snap-x scroll-smooth px-4 items-stretch">
            <div className="shrink-0 w-4" aria-hidden />
            {popularProducts.map((product, index) => (
              <PopularProductCard
                key={product._id}
                product={product}
                onClick={(p) => handleProductClick(p, 'popular')}
                layoutPrefix="popular"
                priority={index === 0 || index === 1}
                restaurantLogo={restaurantInfo?.logo}
                catalogOnly={catalogOnly}
                tenantContext={tenantSlug ? { 
                  slug: tenantSlug, 
                  name: headerTitle, 
                  logoRef: restaurantInfo?.logo?.asset?._ref,
                  openingHours: restaurantInfo?.openingHours,
                  customDateHours: restaurantInfo?.customDateHours,
                  businessCountry: initialData.businessCountry ?? undefined,
                  deliveryPricingMode: initialData.deliveryPricingMode,
                  deliveryFeeMin: initialData.deliveryFeeMin,
                  deliveryFeeMax: initialData.deliveryFeeMax,
                  requiresPersonalShopper: initialData.requiresPersonalShopper,
                  shopperFee: initialData.shopperFee
                } : undefined}
                orderTypeOptions={orderTypeOptions}
                catalogHidePrices={catalogHidePrices}
              />
            ))}
            <div className="shrink-0 w-4" aria-hidden />
          </div>
        </section>
      )}

      {/* View Switcher - Only render after hydration to prevent mismatch */}
      {categories.length > 0 && isHydrated && (
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-end">
          <ViewSwitcher view={viewType} onViewChange={handleViewChange} />
        </div>
      )}

      {/* Menu Grid - Use default viewType until hydrated */}
      <div className="max-w-7xl mx-auto py-8">
        {categories.length > 0 ? (
            <MenuGrid
            menuData={categories}
            onProductClick={handleProductClick}
            scrollOffset={stickyBlockHeight}
            viewType={isHydrated ? viewType : 'thumbnail'}
            restaurantLogo={restaurantInfo?.logo}
            catalogOnly={catalogOnly}
                tenantContext={tenantSlug ? { 
                  slug: tenantSlug, 
                  name: headerTitle, 
                  logoRef: restaurantInfo?.logo?.asset?._ref,
                  openingHours: restaurantInfo?.openingHours,
                  customDateHours: restaurantInfo?.customDateHours,
                  businessCountry: initialData.businessCountry ?? undefined,
                  deliveryPricingMode: initialData.deliveryPricingMode,
                  deliveryFeeMin: initialData.deliveryFeeMin,
                  deliveryFeeMax: initialData.deliveryFeeMax,
                  requiresPersonalShopper: initialData.requiresPersonalShopper,
                  shopperFee: initialData.shopperFee
                } : undefined}
            orderTypeOptions={orderTypeOptions}
            catalogHidePrices={catalogHidePrices}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <p className="text-slate-500 font-medium">
              {t('No menu items found.', 'لم يتم العثور على أصناف في القائمة.')}
            </p>
          </div>
        )}
      </div>

      {/* Product Modal */}
      <ProductModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        layoutPrefix={activeLayoutPrefix}
        restaurantLogo={restaurantInfo?.logo}
        catalogOnly={catalogOnly}
                tenantContext={tenantSlug ? { 
                  slug: tenantSlug, 
                  name: headerTitle, 
                  logoRef: restaurantInfo?.logo?.asset?._ref,
                  openingHours: restaurantInfo?.openingHours,
                  customDateHours: restaurantInfo?.customDateHours,
                  businessCountry: initialData.businessCountry ?? undefined,
                  deliveryPricingMode: initialData.deliveryPricingMode,
                  deliveryFeeMin: initialData.deliveryFeeMin,
                  deliveryFeeMax: initialData.deliveryFeeMax,
                  requiresPersonalShopper: initialData.requiresPersonalShopper,
                  shopperFee: initialData.shopperFee
                } : undefined}
        orderTypeOptions={orderTypeOptions}
        catalogHidePrices={catalogHidePrices}
      />

      {/* About Us Section */}
      {aboutUs && (
        <section className="bg-white py-16 px-4 border-t border-slate-100">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-black mb-6 uppercase tracking-tight">
              {t(aboutUs.title_en, aboutUs.title_ar)}
            </h2>
            <div className="grid md:grid-cols-2 gap-8 items-center text-left rtl:text-right">
              <div className="space-y-4">
                <p className="text-slate-600 leading-relaxed text-lg">
                  {t(aboutUs.content_en || '', aboutUs.content_ar || '')}
                </p>
              </div>
              {aboutUs.image && (
                <div className="relative aspect-square rounded-3xl overflow-hidden shadow-xl">
                  <Image
                    src={urlFor(aboutUs.image).width(600).height(600).url()}
                    alt={t(aboutUs.title_en, aboutUs.title_ar)}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    placeholder="blur"
                    blurDataURL={SHIMMER_PLACEHOLDER}
                    className="object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Footer / Contact - only when user set address, map link, or embed */}
      {((restaurantInfo && (restaurantInfo.address_en || restaurantInfo.address_ar || restaurantInfo.mapsLink || restaurantInfo.mapEmbedUrl)) || locationLat != null) && (
      <footer className="bg-black text-white px-6 py-16 text-center">
        <div className="max-w-7xl mx-auto">
          {restaurantInfo?.logo && (
            <div className="relative w-16 h-16 mx-auto mb-6 grayscale invert">
              <Image
                src={urlFor(restaurantInfo.logo).width(150).height(150).url()}
                alt="Logo"
                fill
                sizes="64px"
                placeholder="blur"
                blurDataURL={SHIMMER_PLACEHOLDER}
                className="object-contain"
              />
            </div>
          )}
          <h2 className="text-2xl font-bold mb-2">
            {t('Visit Us', 'زورونا')}
          </h2>
          {restaurantInfo && (restaurantInfo.tagline_en || restaurantInfo.tagline_ar) && (
            <p className="text-slate-300 text-sm mb-4">
              {t(restaurantInfo.tagline_en || '', restaurantInfo.tagline_ar || '')}
            </p>
          )}
          {((restaurantInfo && (restaurantInfo.address_en || restaurantInfo.address_ar || restaurantInfo.mapsLink)) || locationLat != null) && (
            (locationLat != null && locationLng != null) ? (
              <a
                href={`https://www.google.com/maps?q=${locationLat},${locationLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-8 max-w-lg mx-auto block hover:text-white transition-colors group"
              >
                <div className="flex items-center justify-center gap-2 text-slate-300 text-base font-medium">
                  <MapPin className="w-5 h-5 group-hover:text-white transition-colors" />
                  <span className="group-hover:text-white transition-colors">
                    {t('Navigate to', 'انتقل إلى')} {headerTitle} {restaurantInfo?.address_en || restaurantInfo?.address_ar ? `— ${t(restaurantInfo.address_en || '', restaurantInfo.address_ar || '')}` : ''}
                  </span>
                </div>
              </a>
            ) : restaurantInfo?.mapsLink ? (
              <a
                href={restaurantInfo.mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-8 max-w-lg mx-auto block hover:text-white transition-colors group"
              >
                <div className="flex items-center justify-center gap-2 text-slate-300 text-base font-medium">
                  <MapPin className="w-5 h-5 group-hover:text-white transition-colors" />
                  <span className="group-hover:text-white transition-colors">
                    {t('Navigate to', 'انتقل إلى')} {headerTitle} {restaurantInfo?.address_en || restaurantInfo?.address_ar ? `— ${t(restaurantInfo.address_en || '', restaurantInfo.address_ar || '')}` : ''}
                  </span>
                </div>
              </a>
            ) : (
              <div className="mb-8 max-w-lg mx-auto flex items-center justify-center gap-2 text-slate-300 text-base font-medium">
                <MapPin className="w-5 h-5 shrink-0" />
                <span>{t(restaurantInfo?.address_en || '', restaurantInfo?.address_ar || '')}</span>
              </div>
            )
          )}

          {/* Embedded Google Maps - prefers coordinates, falls back to mapEmbedUrl */}
          {(locationLat != null && locationLng != null) ? (
            <div className="mb-12 max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-2xl">
              <iframe
                src={`https://maps.google.com/maps?q=${locationLat},${locationLng}&hl=en&z=14&output=embed`}
                width="100%"
                height="450"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full"
                title={t('Map', 'الخريطة')}
              />
            </div>
          ) : restaurantInfo?.mapEmbedUrl ? (() => {
            const raw = restaurantInfo.mapEmbedUrl.trim()
            const srcMatch = raw.match(/src=["']([^"']+)["']/)
            const embedSrc = srcMatch ? srcMatch[1] : raw
            return (
            <div className="mb-12 max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-2xl">
              <iframe
                src={embedSrc}
                width="100%"
                height="450"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full"
                title={t('Map', 'الخريطة')}
              />
            </div>
            )
          })() : null}

          <div className="flex justify-center gap-6 mb-12">
            {restaurantInfo?.socials?.facebook && (
              <a href={getSocialProfileUrl('facebook', restaurantInfo.socials.facebook)} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center hover:bg-primary transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
            )}
            {restaurantInfo?.socials?.instagram && (
              <a href={getSocialProfileUrl('instagram', restaurantInfo.socials.instagram)} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center hover:bg-primary transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
            )}
            {restaurantInfo?.socials?.tiktok && (
              <a href={getSocialProfileUrl('tiktok', restaurantInfo.socials.tiktok)} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center hover:bg-primary transition-colors font-bold text-xs">
                TT
              </a>
            )}
            {restaurantInfo?.socials?.snapchat && (
              <a href={getSocialProfileUrl('snapchat', restaurantInfo.socials.snapchat)} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center hover:bg-primary transition-colors">
                <MessageCircle className="w-5 h-5" />
              </a>
            )}
            {restaurantInfo?.socials?.whatsapp && (
              <a
                href={getWhatsAppUrl(restaurantInfo.socials.whatsapp) || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center hover:opacity-90 transition-opacity"
                aria-label="WhatsApp"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
            )}
            {restaurantInfo?.socials?.website && (
              <a href={getSocialProfileUrl('website', restaurantInfo.socials.website)} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center hover:bg-primary transition-colors">
                <Globe className="w-5 h-5" />
              </a>
            )}
          </div>

          <div className="pt-8 border-t border-slate-800 text-slate-500 text-sm space-y-3">
            <div>
              &copy; {new Date().getFullYear()} Burhan Studio. {t('All rights reserved.', 'جميع الحقوق محفوظة.')}
            </div>
            <div className="flex items-center justify-center gap-2 text-slate-400 text-xs flex-wrap">
              <span>{t('This app is developed & designed by', 'هذا التطبيق مطور ومصمم بواسطة')}</span>
              <a
                href="https://burhan.studio"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <Image
                  src="https://cdn.sanity.io/images/b8qogueq/production/ef045424139d4ce5be3cf3e6ca1f0c491ab2107c-300x300.png?fit=max&auto=format"
                  alt="Burhan Studio"
                  width={16}
                  height={16}
                  className="object-contain"
                  unoptimized
                />
                <span className="font-semibold">Burhan Studio</span>
              </a>
            </div>
            {tenantSlug && (
              <div className="pt-2">
                <a href={`/sign-in?redirect_url=${encodeURIComponent(`/t/${tenantSlug}/manage`)}`} className="text-slate-500 hover:text-slate-300 text-xs">
                  {t('Admin Login', 'تسجيل دخول الإدارة')}
                </a>
              </div>
            )}
          </div>
        </div>
      </footer>
      )}

      {/* Footer when Visit us is not set - only PWA + copyright */}
      {(!restaurantInfo || !(restaurantInfo.address_en || restaurantInfo.address_ar || restaurantInfo.mapsLink || restaurantInfo.mapEmbedUrl)) && (
      <footer className="bg-black text-white px-6 py-12 text-center">
        <div className="max-w-7xl mx-auto">
          <div className="pt-8 border-t border-slate-800 text-slate-500 text-sm space-y-3">
            <div>&copy; {new Date().getFullYear()} Burhan Studio. {t('All rights reserved.', 'جميع الحقوق محفوظة.')}</div>
            <div className="flex items-center justify-center gap-2 text-slate-400 text-xs flex-wrap">
              <span>{t('This app is developed & designed by', 'هذا التطبيق مطور ومصمم بواسطة')}</span>
              <a href="https://burhan.studio" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Image src="https://cdn.sanity.io/images/b8qogueq/production/ef045424139d4ce5be3cf3e6ca1f0c491ab2107c-300x300.png?fit=max&auto=format" alt="Burhan Studio" width={16} height={16} className="object-contain" unoptimized />
                <span className="font-semibold">Burhan Studio</span>
              </a>
            </div>
            {tenantSlug && (
              <div className="pt-2">
                <a href={`/sign-in?redirect_url=${encodeURIComponent(`/t/${tenantSlug}/manage`)}`} className="text-slate-500 hover:text-slate-300 text-xs">
                  {t('Admin Login', 'تسجيل دخول الإدارة')}
                </a>
              </div>
            )}
          </div>
        </div>
      </footer>
      )}

      {tenantSlug && initialTableNumber && (
        <TableChoiceModal
          open={showTableChoiceModal}
          onOpenChange={setShowTableChoiceModal}
          tenantSlug={tenantSlug}
          tableNumber={initialTableNumber}
          onViewMenu={handleTableChoiceViewMenu}
        />
      )}

      <Dialog open={showBrowseHomeModal} onOpenChange={setShowBrowseHomeModal}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>{t('Your cart has items', 'سلتك تحتوي على أصناف')}</DialogTitle>
            <DialogDescription>
              {t(
                'Do you want to clear your cart and go to the homepage to browse other businesses? You can also keep your cart and return later to complete your order.',
                'هل ترغب في تفريغ السلّة والذهاب للصفحة الرئيسية لاستعراض أعمال أخرى؟ يمكنك أيضاً الإبقاء على السلّة والعودة لاحقاً لإكمال طلبك.'
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setShowBrowseHomeModal(false)}
            >
              {t('Keep cart', 'الإبقاء على السلّة')}
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                clearCart()
                setShowBrowseHomeModal(false)
                router.push('/')
              }}
            >
              {t('Clear cart and browse', 'تفريغ السلّة واستعراض')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CartToast />

      {/* Floating Cart Action - Desktop only; on mobile, bottom nav has cart */}
      {!catalogOnly && totalItems > 0 && (
        <div className="fixed bottom-6 left-0 right-0 z-40 px-4 pointer-events-none pb-6 hidden md:block">
          <div className="max-w-md mx-auto pointer-events-auto">
            <Button
              onClick={() => setIsOpen(true)}
              className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xl shadow-amber-500/25 font-bold text-base flex items-center justify-between px-6 transition-transform active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-slate-950/15 px-2 text-sm font-bold backdrop-blur-sm">
                  {totalItems}
                </div>
                <span>{t('View Cart', 'عرض السلة')}</span>
              </div>
              <ShoppingCart className="h-5 w-5 opacity-90" />
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}
