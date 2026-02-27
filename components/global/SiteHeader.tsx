'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { MapPin, ChevronDown, User, LogIn, Store, Truck, Menu, ClipboardList, LogOut } from 'lucide-react'
import { useUser, useClerk } from '@clerk/nextjs'
import { useLocation } from '@/components/LocationContext'
import { getCityDisplayName } from '@/lib/registration-translations'
import { useLanguage } from '@/components/LanguageContext'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { UserButton } from '@clerk/nextjs'
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet'
import { PREFER_DRIVER_KEY, PREFER_TENANT_KEY } from '@/components/StandaloneDriverRedirect'

interface SiteHeaderProps {
  /** For homepage: show location + auth. For other pages: optional overrides. */
  variant?: 'home' | 'minimal'
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

/** Sign in / Sign up — single flow; everyone lands on homepage (/) after auth; role choice after login. */
function AuthDropdowns({ t, isRtl, onNavigate }: { t: (en: string, ar: string) => string; isRtl: boolean; onNavigate?: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/sign-in?redirect_url=/"
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        onClick={() => onNavigate?.()}
      >
        <LogIn className="size-4" />
        {t('Sign in', 'تسجيل الدخول')}
      </Link>
      <Link
        href="/sign-up?redirect_url=/"
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        onClick={() => onNavigate?.()}
      >
        <User className="size-4" />
        {t('Sign up', 'إنشاء حساب')}
      </Link>
    </div>
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
      <Link
        href="/"
        onClick={() => { try { localStorage.removeItem(PREFER_DRIVER_KEY); localStorage.removeItem(PREFER_TENANT_KEY) } catch { /* ignore */ } }}
        className={`${base} ${isCustomer ? active : inactive}`}
        title={t('Browse as Customer', 'التصفح كزبون')}
      >
        <User className="size-4 shrink-0" aria-hidden />
        <span className="hidden lg:inline">{t('Customer', 'زبون')}</span>
      </Link>
      <Link
        href="/driver"
        onClick={() => { try { localStorage.setItem(PREFER_DRIVER_KEY, '1'); localStorage.removeItem(PREFER_TENANT_KEY) } catch { /* ignore */ } }}
        className={`${base} ${isDriver ? active : inactive}`}
        title={t('Switch to Driver', 'التبديل إلى سائق')}
      >
        <Truck className="size-4 shrink-0" aria-hidden />
        <span className="hidden lg:inline">{t('Driver', 'سائق')}</span>
      </Link>
      <Link
        href="/dashboard"
        onClick={() => { try { localStorage.removeItem(PREFER_DRIVER_KEY); localStorage.setItem(PREFER_TENANT_KEY, '1') } catch { /* ignore */ } }}
        className={`${base} ${isTenant ? active : inactive}`}
        title={t('Switch to Business', 'التبديل إلى أعمال')}
      >
        <Store className="size-4 shrink-0" aria-hidden />
        <span className="hidden lg:inline">{t('Business', 'أعمال')}</span>
      </Link>
    </div>
  )
}

export function SiteHeader({ variant = 'home' }: SiteHeaderProps) {
  const { t, lang } = useLanguage()
  const { city, setOpenLocationModal } = useLocation()
  const { isSignedIn } = useUser()
  const { signOut } = useClerk()
  const isRtl = lang === 'ar'
  const [menuOpen, setMenuOpen] = useState(false)

  const locationLabel = city ? getCityDisplayName(city, lang) : t('Choose location', 'اختر الموقع')

  const menuContent = variant === 'home' && (
    <>
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
            <Link
              href="/"
              onClick={() => {
                try { localStorage.removeItem(PREFER_DRIVER_KEY); localStorage.removeItem(PREFER_TENANT_KEY) } catch { /* ignore */ }
                setMenuOpen(false)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
            >
              <User className="size-3.5" />
              {t('Browse as Customer', 'التصفح كزبون')}
            </Link>
            <Link
              href="/driver"
              onClick={() => {
                try { localStorage.setItem(PREFER_DRIVER_KEY, '1') } catch { /* ignore */ }
                setMenuOpen(false)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
            >
              <Truck className="size-3.5" />
              {t('Switch to Driver', 'التبديل إلى سائق')}
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
            >
              <Store className="size-3.5" />
              {t('Switch to Business', 'التبديل إلى أعمال')}
            </Link>
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
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="mx-auto flex h-16 min-h-[64px] max-w-[100vw] items-center justify-between gap-4 px-4 sm:container sm:px-6">
        <Link
          href="/"
          className="flex min-w-0 shrink items-center gap-2 font-bold text-slate-900 transition-opacity hover:opacity-80"
        >
          <Image src="/logo.webp" alt="Bedi" width={36} height={36} className="h-9 w-auto shrink-0" />
          <span className="text-xl tracking-tight">Bedi</span>
        </Link>

        {/* Desktop: full inline controls */}
        {variant === 'home' && (
          <>
            <button
              type="button"
              onClick={() => setOpenLocationModal(true)}
              className="hidden md:flex min-w-0 shrink items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-left transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              <MapPin className="size-4 shrink-0 text-emerald-600" />
              <span className="truncate text-sm font-medium text-slate-700">{locationLabel}</span>
              <ChevronDown className="size-4 shrink-0 text-slate-500" />
            </button>

            <div className="hidden md:flex items-center gap-2">
              {isSignedIn && (
                <>
                  <DesktopRoleSwitcher t={t} isRtl={isRtl} />
                  <Link
                    href="/my-orders"
                    className="inline-flex items-center gap-1.5 rounded-full h-9 px-3 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium"
                  >
                    <ClipboardList className="w-4 h-4 shrink-0" />
                    {t('My orders', 'طلباتي')}
                  </Link>
                </>
              )}
              <LanguageSwitcher />
              {isSignedIn ? (
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: { avatarBox: 'size-9' },
                  }}
                />
              ) : (
                <AuthDropdowns t={t} isRtl={isRtl} />
              )}
            </div>
          </>
        )}

        {variant === 'minimal' && (
          <div className="hidden md:flex items-center gap-2">
            <LanguageSwitcher />
          </div>
        )}

        {/* Mobile: hamburger menu */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
    </motion.header>
  )
}
