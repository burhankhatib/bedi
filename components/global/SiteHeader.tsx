'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { MapPin, ChevronDown, User, LogIn, Store, Truck, Menu, ClipboardList, LogOut, Bell, ShoppingCart, Sparkles } from 'lucide-react'
import { useUser, useClerk } from '@clerk/nextjs'
import { useLocation } from '@/components/LocationContext'
import { getCityDisplayName } from '@/lib/registration-translations'
import { useLanguage } from '@/components/LanguageContext'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { UserButton } from '@clerk/nextjs'
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { PREFER_DRIVER_KEY, PREFER_TENANT_KEY } from '@/components/StandaloneDriverRedirect'
import { useCart } from '@/components/Cart/CartContext'
import { PWAInstallIcon } from '@/components/pwa/PWAInstallIcon'
import { getCustomerPWAConfig } from '@/lib/pwa/configs'
import { UniversalSearch } from '@/components/search/UniversalSearch'

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
        <Link
          href="/sign-in?redirect_url=/"
          onClick={onNavigate}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 py-3.5 font-semibold text-slate-800 transition-colors hover:bg-slate-50"
        >
          <LogIn className="size-5" />
          {t('Sign in', 'تسجيل الدخول')}
        </Link>
        <Link
          href="/sign-up?redirect_url=/"
          onClick={onNavigate}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3.5 font-semibold text-white transition-colors hover:bg-slate-800"
        >
          <User className="size-5" />
          {t('Create account', 'إنشاء حساب')}
        </Link>
      </div>
    </div>
  )
}

/** Desktop: 1 clear button for Signup/Signin Modal */
function AuthModalButton({ t, isRtl }: { t: (en: string, ar: string) => string; isRtl: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex shrink-0 items-center justify-center size-10 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition-colors outline-none focus:ring-2 focus:ring-brand-black/20" aria-label={t('Log in', 'تسجيل الدخول')}>
          <User className="size-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8 border-none" dir={isRtl ? 'rtl' : 'ltr'} overlayClassName="z-[500]" contentClassName="z-[500] shadow-2xl">
        <DialogHeader className="mb-6">
          <div className="flex justify-center mb-4">
            <div className="size-16 rounded-full bg-brand-yellow/20 flex items-center justify-center">
              <User className="size-8 text-brand-yellow" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-black text-center text-slate-900 tracking-tight">
            {t('Welcome to Bedi Delivery', 'مرحباً بك في تطبيق بدي')}
          </DialogTitle>
          <DialogDescription className="text-center text-slate-500 mt-2 text-base">
            {t('Choose how you would like to proceed.', 'اختر كيف تود المتابعة.')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Link
            href="/sign-in?redirect_url=/"
            onClick={() => setOpen(false)}
            className="group flex w-full items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 font-bold text-slate-900 transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
          >
            <div className="bg-slate-100 p-2 rounded-full group-hover:bg-white transition-colors">
              <LogIn className="size-5" />
            </div>
            {t('Log in to your account', 'تسجيل الدخول لحسابك')}
          </Link>
          <Link
            href="/sign-up?redirect_url=/"
            onClick={() => setOpen(false)}
            className="group flex w-full items-center gap-3 rounded-2xl bg-brand-black px-5 py-4 font-bold text-white transition-all hover:bg-brand-black/90 hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="bg-white/10 p-2 rounded-full group-hover:bg-white/20 transition-colors">
              <User className="size-5" />
            </div>
            {t('Create a new account', 'إنشاء حساب جديد')}
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Desktop: clear toggle to switch between Customer / Driver / Tenant. Shown only when signed in. */
function DesktopRoleSwitcher({ t, isRtl }: { t: (en: string, ar: string) => string; isRtl: boolean }) {
  const pathname = usePathname() ?? ''
  const isDriver = pathname.startsWith('/driver')
  const isTenant = pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding') || pathname.startsWith('/t/')
  const isCustomer = !isDriver && !isTenant

  const base = 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors'
  const active = 'bg-slate-900 text-white border-slate-900 shadow-sm'
  const inactive = 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300'

  return (
    <div
      className="hidden md:flex items-center gap-0.5 p-0.5 rounded-xl border border-slate-200 bg-slate-50/80"
      role="group"
      aria-label={t('Switch role', 'تبديل الدور')}
    >
      <a
        href="/"
        onClick={() => { try { localStorage.removeItem(PREFER_DRIVER_KEY); localStorage.removeItem(PREFER_TENANT_KEY) } catch { /* ignore */ } }}
        className={`${base} ${isCustomer ? active : inactive}`}
        title={t('Browse as Customer', 'التصفح كزبون')}
      >
        <User className="size-4 shrink-0" aria-hidden />
        <span className="hidden lg:inline">{t('Customer', 'زبون')}</span>
      </a>
      <a
        href="/driver"
        onClick={() => { try { localStorage.setItem(PREFER_DRIVER_KEY, '1'); localStorage.removeItem(PREFER_TENANT_KEY) } catch { /* ignore */ } }}
        className={`${base} ${isDriver ? active : inactive}`}
        title={t('Switch to Driver', 'التبديل إلى سائق')}
      >
        <Truck className="size-4 shrink-0" aria-hidden />
        <span className="hidden lg:inline">{t('Driver', 'سائق')}</span>
      </a>
      <a
        href="/dashboard"
        onClick={() => { try { localStorage.removeItem(PREFER_DRIVER_KEY); localStorage.setItem(PREFER_TENANT_KEY, '1') } catch { /* ignore */ } }}
        className={`${base} ${isTenant ? active : inactive}`}
        title={t('Switch to Business', 'التبديل إلى أعمال')}
      >
        <Store className="size-4 shrink-0" aria-hidden />
        <span className="hidden lg:inline">{t('Business', 'أعمال')}</span>
      </a>
    </div>
  )
}

export function SiteHeader({ variant = 'home', showSearch = true }: SiteHeaderProps) {
  const { t, lang } = useLanguage()
  const { city, setOpenLocationModal } = useLocation()
  const { isSignedIn } = useUser()
  const { signOut } = useClerk()
  const isRtl = lang === 'ar'
  const [menuOpen, setMenuOpen] = useState(false)

  const router = useRouter()
  const { totalItems, setIsOpen } = useCart()
  const [globalOrderType, setGlobalOrderType] = useState<'delivery' | 'pickup'>('delivery')

  useEffect(() => {
    const saved = localStorage.getItem('global_order_type')
    if (saved === 'pickup') setGlobalOrderType('pickup')
  }, [])

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
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600">{t('Account', 'الحساب')}</span>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'size-10',
                  userButtonPopoverCard: 'z-[100]',
                },
              }}
            />
          </div>
          <p className="text-xs text-slate-500">{t('Switch to', 'التبديل إلى')}</p>
          <div className="flex flex-wrap gap-2">
            <a
              href="/"
              onClick={() => {
                try { localStorage.removeItem(PREFER_DRIVER_KEY); localStorage.removeItem(PREFER_TENANT_KEY) } catch { /* ignore */ }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
            >
              <User className="size-3.5" />
              {t('Browse as Customer', 'التصفح كزبون')}
            </a>
            <a
              href="/driver"
              onClick={() => {
                try { localStorage.setItem(PREFER_DRIVER_KEY, '1') } catch { /* ignore */ }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
            >
              <Truck className="size-3.5" />
              {t('Switch to Driver', 'التبديل إلى سائق')}
            </a>
            <a
              href="/dashboard"
              onClick={() => {
                try { localStorage.removeItem(PREFER_DRIVER_KEY); localStorage.setItem(PREFER_TENANT_KEY, '1') } catch { /* ignore */ }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
            >
              <Store className="size-3.5" />
              {t('Switch to Business', 'التبديل إلى أعمال')}
            </a>
          </div>
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
          <Image src="/logo.webp" alt="Bedi Delivery" width={36} height={36} className="h-9 w-auto shrink-0" />
          <span className="text-xl font-semibold tracking-tight [font-family:var(--font-brand),var(--font-cairo),ui-sans-serif,sans-serif]">Bedi Delivery</span>
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
                <LanguageSwitcher />
                {isSignedIn ? (
                  <UserButton
                    afterSignOutUrl="/"
                    appearance={{ elements: { avatarBox: 'size-[42px]' } }}
                  />
                ) : (
                  <AuthModalButton t={t} isRtl={isRtl} />
                )}
              </div>

              {/* 4. PWA Install Icon – subtle, icon-only install CTA */}
              <PWAInstallIcon config={getCustomerPWAConfig()} className="text-emerald-600 ring-emerald-400/30 hover:bg-emerald-500/25" />

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
          {!isSignedIn && <AuthModalButton t={t} isRtl={isRtl} />}
          
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
