'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { Menu, Package, BarChart3, User, History, LogOut, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useLanguage } from '@/components/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { DriverDashboardNav } from './DriverDashboardNav'
import { DriverPushSetup } from './DriverPushSetup'
import { DriverPushProvider } from './DriverPushContext'
import { DriverOrdersGate } from './DriverOrdersGate'
import { DriverStatusProvider } from './DriverStatusContext'
import { DriverStatusPushReminder } from './DriverStatusPushReminder'
import { DriverInviteInMenu } from './DriverInviteInMenu'
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt'
import { PREFER_DRIVER_KEY } from '@/components/StandaloneDriverRedirect'

const NAV_ITEMS = [
  { href: '/driver/orders', labelEn: 'Orders', labelAr: 'طلبات', icon: Package },
  { href: '/driver/history', labelEn: 'History', labelAr: 'السجل', icon: History },
  { href: '/driver/analytics', labelEn: 'Analytics', labelAr: 'التحليلات', icon: BarChart3 },
  { href: '/driver/profile', labelEn: 'Profile', labelAr: 'الملف الشخصي', icon: User },
]

/** Sign out from driver app; redirect to homepage. */
function DriverSignOutButton({ onClose }: { onClose: () => void }) {
  const { signOut } = useClerk()
  const { t } = useLanguage()
  return (
    <button
      type="button"
      className="mt-3 flex w-full items-center gap-3 px-6 py-3.5 text-slate-400 hover:bg-slate-800/80 hover:text-white"
      onClick={() => {
        onClose()
        signOut({ redirectUrl: typeof window !== 'undefined' ? window.location.origin + '/' : '/' })
      }}
    >
      <LogOut className="size-5 shrink-0" />
      {t('Sign out', 'تسجيل الخروج')}
    </button>
  )
}

const DRIVER_SETUP_PATHS = ['/driver/profile', '/driver/join']

export function DriverLayoutClient({
  children,
  hasNoProfileYet,
}: {
  children: React.ReactNode
  hasNoProfileYet?: boolean
}) {
  const { t, lang } = useLanguage()
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const navLabel = (item: (typeof NAV_ITEMS)[0]) => (lang === 'ar' ? item.labelAr : item.labelEn)
  const isRtl = lang === 'ar'

  if (hasNoProfileYet && pathname && !DRIVER_SETUP_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    router.replace('/driver/profile')
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
        <p>{t('Redirecting…', 'جاري التوجيه...')}</p>
      </div>
    )
  }

  useEffect(() => {
    try {
      localStorage.setItem(PREFER_DRIVER_KEY, '1')
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (hasNoProfileYet || !pathname || pathname === '/driver/profile') return
    fetch('/api/driver/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data == null || !data._id) router.replace('/driver/profile')
      })
      .catch(() => {})
  }, [pathname, router, hasNoProfileYet])

  return (
    <DriverPushProvider>
    <DriverStatusProvider>
    <div className="min-h-screen min-h-[100dvh] bg-slate-950 text-white" dir={isRtl ? 'rtl' : 'ltr'} lang={lang}>
      <DriverStatusPushReminder />
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto w-full max-w-[100vw] px-3 sm:max-w-lg sm:px-4">
          <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-4">
            {/* Row: Hamburger (mobile) | Toggle (center) | Bedi Driver (right). Desktop: Home + nav + toggle. */}
            <div className="flex min-h-[48px] w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 text-slate-400 hover:text-white sm:hidden"
                onClick={() => setMenuOpen(true)}
                aria-label={t('Open menu', 'فتح القائمة')}
              >
                <Menu className="size-6" />
              </Button>
              <div className="flex flex-1 justify-center sm:justify-start sm:flex-initial">
                <DriverDashboardNav />
              </div>
              <Link href="/driver" className="font-black text-lg text-white hover:text-slate-200 shrink-0 sm:text-base">
                Bedi Driver
              </Link>
            </div>

            {/* Mobile: full-width nav pills (2x2 grid). Desktop: inline links. When no profile yet, only Profile. */}
            <nav className="grid w-full grid-cols-2 gap-2 sm:hidden" aria-label={t('Navigation', 'التنقل')}>
              {(hasNoProfileYet ? NAV_ITEMS.filter((i) => i.href === '/driver/profile') : NAV_ITEMS).map((item) => (
                <Link key={item.href} href={item.href} className="min-h-[48px]">
                  <span
                    className={`flex h-full min-h-[48px] items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-center text-sm font-semibold transition-colors ${
                      pathname === item.href
                        ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300'
                        : 'border-slate-700 bg-slate-800/80 text-slate-200 hover:border-slate-600 hover:bg-slate-800'
                    }`}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {navLabel(item)}
                  </span>
                </Link>
              ))}
            </nav>
            <div className="hidden items-center gap-6 sm:flex">
              {!hasNoProfileYet && (
                <Link href="/driver" className="text-sm font-medium text-slate-400 hover:text-white sm:text-base">
                  {t('Home', 'الرئيسية')}
                </Link>
              )}
              {(hasNoProfileYet ? NAV_ITEMS.filter((i) => i.href === '/driver/profile') : NAV_ITEMS).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium text-slate-400 hover:text-white sm:text-base"
                >
                  {navLabel(item)}
                </Link>
              ))}
              <div className="shrink-0">
                <DriverDashboardNav />
              </div>
            </div>
          </div>
        </div>
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side={isRtl ? 'left' : 'right'}
          className="w-[min(100vw-2rem,300px)] border-slate-800 bg-slate-950 p-0 pt-[max(1.5rem,env(safe-area-inset-top))] [&_button]:text-slate-400 [&_button]:hover:bg-slate-800 [&_button]:hover:text-white"
        >
          <SheetTitle className="sr-only">{t('Menu', 'القائمة')}</SheetTitle>
          <nav className="flex flex-col pb-6 pt-4" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="mb-2 px-4 pb-3 border-b border-slate-800">
              <LanguageSwitcher />
            </div>
            <Link
              href="/"
              onClick={() => {
                try { localStorage.removeItem(PREFER_DRIVER_KEY) } catch { /* ignore */ }
                setMenuOpen(false)
              }}
              className="flex items-center gap-3 px-6 py-4 text-slate-200 hover:bg-slate-800/80 hover:text-white"
            >
              <Home className="size-5 shrink-0" />
              {t('Switch to Customer', 'التبديل إلى زبون')}
            </Link>
            {!hasNoProfileYet && (
              <Link
                href="/driver"
                className="flex items-center gap-3 px-6 py-4 text-slate-200 hover:bg-slate-800/80 hover:text-white"
                onClick={() => setMenuOpen(false)}
              >
                <Package className="size-5 shrink-0" />
                {t('Home', 'الرئيسية')}
              </Link>
            )}
            {(hasNoProfileYet ? NAV_ITEMS.filter((i) => i.href === '/driver/profile') : NAV_ITEMS).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-6 py-4 text-slate-200 hover:bg-slate-800/80 hover:text-white"
                onClick={() => setMenuOpen(false)}
              >
                <item.icon className="size-5 shrink-0" />
                {navLabel(item)}
              </Link>
            ))}
            {!hasNoProfileYet && <DriverInviteInMenu />}
            <div className="mt-4 border-t border-slate-800 px-6 pt-4">
              <DriverDashboardNav />
              <DriverSignOutButton onClose={() => setMenuOpen(false)} />
            </div>
          </nav>
        </SheetContent>
      </Sheet>

      <main className="mx-auto max-w-lg px-4 py-4 sm:py-6 sm:max-w-[100vw]">
        <PWAUpdatePrompt
          scriptUrl="/driver/sw.js"
          scope="/driver"
          rtl={isRtl}
          titleEn="New version available"
          titleAr="يتوفر إصدار جديد"
          reloadEn="Reload to update"
          reloadAr="تحديث الآن"
        />
        {pathname !== '/driver/profile' && <DriverPushSetup />}
        <DriverOrdersGate>
          {children}
        </DriverOrdersGate>
      </main>
    </div>
    </DriverStatusProvider>
    </DriverPushProvider>
  )
}
