'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  MapPin,
  ChevronDown,
  User,
  LogIn,
  Store,
  Truck,
  Menu,
  ClipboardList,
  LogOut,
  Bell,
  ShoppingCart,
  Sparkles,
  LayoutDashboard,
} from 'lucide-react'
import { useUser, useClerk } from '@clerk/nextjs'
import { useLocation } from '@/components/LocationContext'
import { getCityDisplayName } from '@/lib/registration-translations'
import { useLanguage } from '@/components/LanguageContext'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet'
import { PREFER_DRIVER_KEY, PREFER_TENANT_KEY } from '@/components/StandaloneDriverRedirect'
import { useCart } from '@/components/Cart/CartContext'
import { PWAInstallIcon } from '@/components/pwa/PWAInstallIcon'
import { getCustomerPWAConfig } from '@/lib/pwa/configs'
import { UniversalSearch } from '@/components/search/UniversalSearch'
import { CustomerProfileAvatar, CustomerProfileAvatarLink } from '@/components/customer/CustomerProfileAvatarLink'

interface SiteHeaderProps {
  /** For homepage: show location + auth. For other pages: optional overrides. */
  variant?: 'home' | 'minimal'
  /** Hide header search (e.g. when search page has its own unified search bar). Default true. */
  showSearch?: boolean
}

/** Mobile: Sign in and Create account — everyone lands on homepage after auth; role choice is after login. */
function HamburgerAuthSection({
  t,
  onNavigate,
}: {
  t: (en: string, ar: string) => string
  menuOpen: boolean
  onNavigate: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <a
          href="/sign-in?redirect_url=/"
          onClick={onNavigate}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 py-3.5 font-semibold text-slate-800 transition-colors hover:bg-slate-50"
        >
          <LogIn className="size-5" />
          {t('Sign in', 'تسجيل الدخول')}
        </a>
        <a
          href="/sign-up?redirect_url=/"
          onClick={onNavigate}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3.5 font-semibold text-white transition-colors hover:bg-slate-800"
        >
          <User className="size-5" />
          {t('Create account', 'إنشاء حساب')}
        </a>
      </div>
    </div>
  )
}

/**
 * Auth entry: use <a> to force full load and clean session state.
 * (Verification, AI links, and header auth use <a>; normal browsing uses Link for fast SPA.)
 */
function AuthEntryButton({ t }: { t: (en: string, ar: string) => string; isRtl: boolean }) {
  return (
    <a
      href="/sign-in?redirect_url=/"
      className="inline-flex shrink-0 items-center justify-center size-10 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition-colors outline-none focus:ring-2 focus:ring-brand-black/20 touch-manipulation"
      aria-label={t('Log in', 'تسجيل الدخول')}
    >
      <User className="size-5" />
    </a>
  )
}

type MeContext = { tenants: { slug: string; name?: string }[]; isDriver: boolean }

/** M3 filled — primary action (business dashboard). */
const m3FilledPrimary =
  'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold shadow-[var(--m3-elevation-1)] outline-none transition-[transform,box-shadow,opacity] duration-[var(--m3-duration-short)] ease-[var(--m3-ease-standard)] hover:shadow-[var(--m3-elevation-2)] focus-visible:ring-2 focus-visible:ring-[var(--m3-primary)] focus-visible:ring-offset-2 active:scale-[0.98] bg-[var(--m3-primary)] text-[var(--m3-on-primary)] hover:opacity-95 touch-manipulation'

/** M3 filled tonal — secondary role (driver). */
const m3FilledDriver =
  'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold shadow-[var(--m3-elevation-1)] outline-none transition-[transform,box-shadow,opacity] duration-[var(--m3-duration-short)] ease-[var(--m3-ease-standard)] hover:shadow-[var(--m3-elevation-2)] focus-visible:ring-2 focus-visible:ring-[var(--m3-secondary-container)] focus-visible:ring-offset-2 active:scale-[0.98] bg-[var(--m3-secondary-container)] text-[var(--m3-on-secondary-container)] hover:opacity-95 touch-manipulation'

/** Mobile: full-width M3 list button (48dp min height). */
const m3MobileRowPrimary =
  'flex w-full min-h-12 items-center justify-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold shadow-[var(--m3-elevation-1)] transition-[transform,box-shadow,opacity] duration-[var(--m3-duration-short)] ease-[var(--m3-ease-standard)] active:scale-[0.99] bg-[var(--m3-primary)] text-[var(--m3-on-primary)] hover:opacity-95 touch-manipulation'

const m3MobileRowDriver =
  'flex w-full min-h-12 items-center justify-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold shadow-[var(--m3-elevation-1)] transition-[transform,box-shadow,opacity] duration-[var(--m3-duration-short)] ease-[var(--m3-ease-standard)] active:scale-[0.99] bg-[var(--m3-secondary-container)] text-[var(--m3-on-secondary-container)] hover:opacity-95 touch-manipulation'

function preferTenant() {
  try {
    localStorage.removeItem(PREFER_DRIVER_KEY)
    localStorage.setItem(PREFER_TENANT_KEY, '1')
  } catch {
    /* ignore */
  }
}

function preferDriver() {
  try {
    localStorage.setItem(PREFER_DRIVER_KEY, '1')
    localStorage.removeItem(PREFER_TENANT_KEY)
  } catch {
    /* ignore */
  }
}

export function SiteHeader({ variant = 'home', showSearch = true }: SiteHeaderProps) {
  const { t, lang } = useLanguage()
  const { city, setOpenLocationModal } = useLocation()
  const { isSignedIn } = useUser()
  const { signOut } = useClerk()
  const isRtl = lang === 'ar'
  const [menuOpen, setMenuOpen] = useState(false)
  const [meContext, setMeContext] = useState<MeContext | null>(null)

  const { totalItems, setIsOpen } = useCart()
  const [globalOrderType, setGlobalOrderType] = useState<'delivery' | 'pickup'>('delivery')

  useEffect(() => {
    const saved = localStorage.getItem('global_order_type')
    if (saved === 'pickup') setGlobalOrderType('pickup')
  }, [])

  useEffect(() => {
    if (!isSignedIn) {
      setMeContext(null)
      return
    }
    let cancelled = false
    fetch('/api/me/context')
      .then((res) => res.json())
      .then((data: { tenants?: { slug: string; name?: string }[]; isDriver?: boolean }) => {
        if (cancelled) return
        setMeContext({
          tenants: Array.isArray(data.tenants) ? data.tenants : [],
          isDriver: data.isDriver === true,
        })
      })
      .catch(() => {
        if (!cancelled) setMeContext({ tenants: [], isDriver: false })
      })
    return () => {
      cancelled = true
    }
  }, [isSignedIn])

  const hasTenantAccess = (meContext?.tenants.length ?? 0) > 0
  const hasDriverAccess = meContext?.isDriver === true
  const meContextLoaded = Boolean(isSignedIn && meContext)
  const showWorkDashboardEntry = Boolean(meContextLoaded && (hasTenantAccess || hasDriverAccess))

  const handleToggleOrderType = (type: 'delivery' | 'pickup') => {
    setGlobalOrderType(type)
    localStorage.setItem('global_order_type', type)
  }

  const locationLabel = city ? getCityDisplayName(city, lang) : t('Choose location', 'اختر الموقع')

  const menuContent = variant === 'home' && (
    <>
      {showSearch && (
        <div className="md:hidden mb-4">
          <UniversalSearch compact placeholder={t("e.g. Broast, pizza, or How to cook Broast", "مثال: بروست، بيتزا، أو كيف أطبخ البروست")} />
        </div>
      )}
      <button
        type="button"
        onClick={() => { setOpenLocationModal(true); setMenuOpen(false); }}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-left transition-colors hover:bg-slate-100"
      >
        <MapPin className="size-5 shrink-0 text-emerald-600" />
        <span className="flex-1 truncate text-sm font-medium text-slate-700">{locationLabel}</span>
        <ChevronDown className="size-4 shrink-0 text-slate-500" />
      </button>
      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-5 py-4">
        <span className="text-sm font-medium text-slate-600">{t('Language', 'اللغة')}</span>
        <LanguageSwitcher />
      </div>
      {isSignedIn ? (
        <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 px-5 py-4">
          <Link
            href="/profile"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 rounded-lg py-3 px-3 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <CustomerProfileAvatar size="md" />
            <span className="font-medium">{t('My profile', 'حسابي')}</span>
          </Link>
          <Link
            href="/my-orders"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 rounded-lg py-3 px-3 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ClipboardList className="w-5 h-5 text-slate-500" />
            {t('My orders', 'طلباتي')}
          </Link>
          <Link
            href="/my-questions"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 rounded-lg py-3 px-3 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Sparkles className="w-5 h-5 text-slate-500" />
            {t('Search history', 'سجل البحث')}
          </Link>
          {showWorkDashboardEntry ? (
            <div className="rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container)] p-3 shadow-[var(--m3-elevation-1)]">
              <p className="px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--m3-on-surface-variant)]">
                {t('Work', 'مساحة العمل')}
              </p>
              <div className="flex flex-col gap-2">
                {hasTenantAccess && (
                  <a
                    href="/dashboard"
                    onClick={() => {
                      preferTenant()
                      setMenuOpen(false)
                    }}
                    className={m3MobileRowPrimary}
                  >
                    <LayoutDashboard className="size-5 shrink-0" aria-hidden />
                    {t('Business dashboard', 'لوحة الأعمال')}
                  </a>
                )}
                {hasDriverAccess && (
                  <a
                    href="/driver"
                    onClick={() => {
                      preferDriver()
                      setMenuOpen(false)
                    }}
                    className={m3MobileRowDriver}
                  >
                    <Truck className="size-5 shrink-0" aria-hidden />
                    {t('Driver dashboard', 'لوحة السائق')}
                  </a>
                )}
              </div>
              <a
                href="/"
                onClick={() => {
                  try {
                    localStorage.removeItem(PREFER_DRIVER_KEY)
                    localStorage.removeItem(PREFER_TENANT_KEY)
                  } catch {
                    /* ignore */
                  }
                  setMenuOpen(false)
                }}
                className="mt-1 flex w-full min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--m3-outline)] bg-[var(--m3-surface-container-high)] px-3 py-2.5 text-sm font-semibold text-[var(--m3-on-surface)] transition-colors duration-[var(--m3-duration-short)] ease-[var(--m3-ease-standard)] hover:bg-[var(--m3-surface-container-low)] active:scale-[0.99] touch-manipulation"
              >
                <User className="size-4 shrink-0 text-[var(--m3-on-surface-variant)]" aria-hidden />
                {t('Browse as Customer', 'التصفح كزبون')}
              </a>
            </div>
          ) : (
            meContextLoaded && (
              <>
                <p className="text-xs text-slate-500">{t('Switch to', 'التبديل إلى')}</p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/"
                    onClick={() => {
                      try {
                        localStorage.removeItem(PREFER_DRIVER_KEY)
                        localStorage.removeItem(PREFER_TENANT_KEY)
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                  >
                    <User className="size-3.5" />
                    {t('Browse as Customer', 'التصفح كزبون')}
                  </a>
                  <a
                    href="/driver"
                    onClick={() => {
                      try {
                        localStorage.setItem(PREFER_DRIVER_KEY, '1')
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
                  >
                    <Truck className="size-3.5" />
                    {t('Switch to Driver', 'التبديل إلى سائق')}
                  </a>
                  <a
                    href="/dashboard"
                    onClick={() => {
                      try {
                        localStorage.removeItem(PREFER_DRIVER_KEY)
                        localStorage.setItem(PREFER_TENANT_KEY, '1')
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
                  >
                    <Store className="size-3.5" />
                    {t('Switch to Business', 'التبديل إلى أعمال')}
                  </a>
                </div>
              </>
            )
          )}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              signOut({ redirectUrl: typeof window !== 'undefined' ? window.location.origin + '/' : '/' })
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3.5 font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100 touch-manipulation"
          >
            <LogOut className="size-5 shrink-0" />
            {t('Sign out', 'تسجيل الخروج')}
          </button>
        </div>
      ) : (
        <HamburgerAuthSection t={t} menuOpen={menuOpen} onNavigate={() => setMenuOpen(false)} />
      )}
    </>
  )

  const minimalMenuContent = variant === 'minimal' && (
    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
      <span className="text-sm font-medium text-slate-500">{t('Language', 'اللغة')}</span>
      <LanguageSwitcher />
    </div>
  )

  return (
    <header
      className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm pt-[env(safe-area-inset-top)]"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="mx-auto flex h-[72px] min-h-[72px] max-w-[100vw] items-center justify-between gap-3 md:gap-6 px-4 sm:container sm:px-6">
        <Link
          href="/"
          className="flex min-w-0 shrink items-center gap-2 font-bold text-slate-900 transition-opacity hover:opacity-80"
        >
          <Image src="/logo.webp" alt={t('Bedi Delivery', 'بدي ديليفري')} width={36} height={36} className="h-9 w-auto shrink-0" />
          <span className="text-xl font-bold tracking-tight [font-family:var(--font-cairo),ui-sans-serif,sans-serif]">{t('Bedi Delivery', 'بدي ديليفري')}</span>
        </Link>

        {/* Desktop: full inline controls */}
        {variant === 'home' && (
          <>
            {/* 1. Address button - DoorDash style gray pill */}
            <button
              type="button"
              onClick={() => setOpenLocationModal(true)}
              className="hidden lg:flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-200"
            >
              <MapPin className="size-4 shrink-0 text-slate-900" />
              <span className="max-w-[140px] truncate">{locationLabel}</span>
              <ChevronDown className="size-4 shrink-0 text-slate-600" />
            </button>

            {/* 2. Global Search (flex-1 so it expands) — instant results, typo helper */}
            {showSearch && (
              <div className="hidden md:flex flex-1 max-w-xl">
                <UniversalSearch
                  placeholder={t('Search Bedi Delivery', 'ابحث في بدي')}
                  inputClassName="w-full"
                />
              </div>
            )}

            <div className="flex items-center gap-2 lg:gap-3 shrink-0">
              {/* 3. Delivery / Pickup Toggle - Segmented pill */}
              <div className="hidden md:flex shrink-0 items-center rounded-full bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => handleToggleOrderType('delivery')}
                  className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
                    globalOrderType === 'delivery' ? 'bg-brand-black text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t('Delivery', 'توصيل')}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleOrderType('pickup')}
                  className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${
                    globalOrderType === 'pickup' ? 'bg-brand-black text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t('Pickup', 'استلام')}
                </button>
              </div>

              {/* Account Dropdown & Language */}
              <div className="hidden md:flex items-center gap-2 ms-2">
                {variant === 'home' && showWorkDashboardEntry && (
                  <div className="flex items-center gap-2 pe-1">
                    {hasTenantAccess && (
                      <a
                        href="/dashboard"
                        onClick={preferTenant}
                        className={m3FilledPrimary}
                        title={t('Business dashboard', 'لوحة الأعمال')}
                      >
                        <LayoutDashboard className="size-4 shrink-0" aria-hidden />
                        <span>{t('Dashboard', 'لوحة التحكم')}</span>
                      </a>
                    )}
                    {hasDriverAccess && (
                      <a
                        href="/driver"
                        onClick={preferDriver}
                        className={m3FilledDriver}
                        title={t('Driver dashboard', 'لوحة السائق')}
                      >
                        <Truck className="size-4 shrink-0" aria-hidden />
                        <span>{t('Driver', 'سائق')}</span>
                      </a>
                    )}
                  </div>
                )}
                <LanguageSwitcher />
                {isSignedIn ? (
                  <CustomerProfileAvatarLink
                    size="md"
                    ariaLabel={t('My profile', 'حسابي')}
                    className="ring-offset-2 ring-offset-white"
                  />
                ) : (
                  <AuthEntryButton t={t} isRtl={isRtl} />
                )}
              </div>

              {/* PWA install: mobile only — not shown on md+ viewports */}
              <div className="md:hidden">
                <PWAInstallIcon config={getCustomerPWAConfig()} className="text-emerald-600 ring-emerald-400/30 hover:bg-emerald-500/25" />
              </div>

              {/* 5. Notification Placeholder (Visually hidden pending feature) */}
              <button type="button" className="hidden relative p-2 text-slate-600 hover:text-slate-900 transition-colors" aria-label="Notifications">
                <Bell className="size-6" />
                <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-brand-red border-2 border-white" />
              </button>

              {/* 6. Minimal Cart Button (Red like DoorDash) */}
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="hidden md:flex items-center gap-2 rounded-full bg-brand-red px-4 py-2.5 text-white hover:bg-brand-red/90 transition-all font-bold shadow-sm"
              >
                <ShoppingCart className="size-[22px] shrink-0" />
                <span className="text-[15px]">{totalItems}</span>
              </button>
            </div>
          </>
        )}

        {variant === 'minimal' && (
          <div className="hidden md:flex items-center gap-2">
            <LanguageSwitcher />
          </div>
        )}

        {/* Mobile controls: PWA icon next to logo (in desktop block), menu on right. Hide PWA from this block to avoid duplicate. */}
        <div className="md:hidden flex flex-1 items-center justify-end gap-2">
          {!isSignedIn && <AuthEntryButton t={t} isRtl={isRtl} />}
          
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                aria-label={t('Menu', 'القائمة')}
              >
                <Menu className="size-6" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side={isRtl ? 'left' : 'right'}
              className="w-[min(340px,92vw)] flex flex-col gap-0 overflow-y-auto p-0"
              onInteractOutside={(e) => {
                const target = e.target as HTMLElement
                if (target.closest('[class*="cl-"]')) e.preventDefault()
              }}
            >
            <div
              className="sticky top-0 z-10 border-b border-slate-100 bg-white pb-4 pt-[max(1.5rem,env(safe-area-inset-top))]"
              style={{ paddingLeft: 'max(1.25rem, env(safe-area-inset-left))', paddingRight: 'max(1.25rem, env(safe-area-inset-right))' }}
            >
              <SheetTitle className="text-lg font-bold text-slate-900">{t('Menu', 'القائمة')}</SheetTitle>
              <SheetDescription className="sr-only">
                {t('Location, language, and account options', 'خيارات الموقع واللغة والحساب')}
              </SheetDescription>
            </div>
            <div
              className="flex flex-col gap-5 py-5"
              style={{ paddingLeft: 'max(1.25rem, env(safe-area-inset-left))', paddingRight: 'max(1.25rem, env(safe-area-inset-right))' }}
            >
              {menuContent}
              {minimalMenuContent}
            </div>
          </SheetContent>
        </Sheet>
        </div>
      </div>
    </header>
  )
}
