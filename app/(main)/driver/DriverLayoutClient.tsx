'use client'

import { useState, useEffect, useRef, startTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { Menu, Package, BarChart3, User, History, LogOut, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useLanguage } from '@/components/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { DriverDashboardNav } from './DriverDashboardNav'
import { DriverPullToRefresh } from './DriverPullToRefresh'
import { DriverPushSetup } from './DriverPushSetup'
import { DriverLocationSetup } from './DriverLocationSetup'
import { DriverPushProvider } from './DriverPushContext'
import { DriverOrdersGate } from './DriverOrdersGate'
import { DriverStatusProvider } from './DriverStatusContext'
import { DriverStatusPushReminder } from './DriverStatusPushReminder'
import { DriverLocationTracker } from './DriverLocationTracker'
import { DriverInviteInMenu } from './DriverInviteInMenu'
import { DriverSidebarActions } from './DriverSidebarActions'
import { PWAManager } from '@/components/pwa/PWAManager'
import { PWAInstallIcon } from '@/components/pwa/PWAInstallIcon'
import { PWAReinstallHelp } from '@/components/pwa/PWAReinstallHelp'
import { DriverPushStatusCard } from '@/components/push/DriverPushStatusCard'
import { getDriverPWAConfig } from '@/lib/pwa/configs'
import { isStandaloneMode } from '@/lib/pwa/detect'
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
  const profileCheckAbortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(false)

  const needsRedirect = hasNoProfileYet && pathname && !DRIVER_SETUP_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      profileCheckAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!needsRedirect) return
    const target = '/driver/profile'
    if (typeof window !== 'undefined' && isStandaloneMode()) {
      window.location.href = target
      return
    }
    router.replace(target)
    const fallback = setTimeout(() => {
      if (typeof window !== 'undefined' && window.location.pathname !== target) {
        window.location.href = target
      }
    }, 2500)
    return () => clearTimeout(fallback)
  }, [needsRedirect, router])

  useEffect(() => {
    try {
      localStorage.setItem(PREFER_DRIVER_KEY, '1')
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (hasNoProfileYet || !pathname || pathname === '/driver/profile') return
    profileCheckAbortRef.current?.abort()
    const ac = new AbortController()
    profileCheckAbortRef.current = ac
    fetch('/api/driver/profile', { signal: ac.signal })
      .then((r) => r.json())
      .then((data) => {
        if (!mountedRef.current || ac.signal.aborted) return
        if (data == null || !data._id) router.replace('/driver/profile')
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return
      })
    return () => ac.abort()
  }, [pathname, router, hasNoProfileYet])

  const hasTenants = false // Or your actual logic to determine this

  if (needsRedirect) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
        <p>{t('Redirecting…', 'جاري التوجيه...')}</p>
      </div>
    )
  }

  return (
    <DriverPushProvider>
    <DriverStatusProvider>
    <DriverLocationTracker />
    <div className="dark min-h-screen min-h-[100dvh] bg-slate-950 text-white" dir={isRtl ? 'rtl' : 'ltr'} lang={lang}>
      <DriverStatusPushReminder />
      <header className="sticky top-0 z-10 border-b border-slate-800/60 bg-slate-950/95 backdrop-blur shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto w-full max-w-[100vw] sm:max-w-lg px-3 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 shrink-0 rounded-full text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => setMenuOpen(true)}
              aria-label={t('Open menu', 'فتح القائمة')}
            >
              <Menu className="size-6" />
            </Button>
            <Link href="/driver/orders" className="font-black text-lg sm:text-xl text-white hover:text-slate-200 tracking-wide">
              Bedi Driver
            </Link>
            <Link
              href="/"
              onClick={() => { try { localStorage.removeItem(PREFER_DRIVER_KEY) } catch { /* ignore */ } }}
              className="hidden sm:inline-flex items-center gap-1.5 ml-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              <ArrowLeft className="size-3.5" style={isRtl ? { transform: 'scaleX(-1)' } : undefined} />
              {t('Back to Bedi Delivery', 'العودة لبدي للتوصيل')}
            </Link>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallIcon config={getDriverPWAConfig()} className="bg-emerald-500/20 text-emerald-400 ring-emerald-400/30 hover:bg-emerald-500/30" />
            {/* When PWA installed: reinstall moved to bottom PushStatusCard */}
            {!isStandaloneMode() && <PWAReinstallHelp config={getDriverPWAConfig()} variant="icon" />}
            <DriverDashboardNav />
          </div>
        </div>
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side={isRtl ? 'left' : 'right'}
          className="w-[min(100vw-2rem,320px)] border-slate-800/60 bg-slate-950 p-0 pt-[max(1.5rem,env(safe-area-inset-top))] flex flex-col"
        >
          <SheetTitle className="sr-only">{t('Menu', 'القائمة')}</SheetTitle>
          <nav className="flex flex-col h-full overflow-y-auto pb-6 pt-2" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="mb-4 px-6 pb-4 border-b border-slate-800/60">
              <h2 className="text-xl font-black text-white mb-4">Bedi Driver</h2>
              <LanguageSwitcher />
            </div>
            
            <div className="flex flex-col px-3 space-y-1 flex-1">
              <Link
                href="/"
                onClick={() => {
                  setMenuOpen(false)
                  try { localStorage.removeItem(PREFER_DRIVER_KEY) } catch { /* ignore */ }
                }}
                className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors"
              >
                <ArrowLeft className="size-6 text-slate-400" style={isRtl ? { transform: 'scaleX(-1)' } : undefined} />
                <span className="font-medium text-[15px]">{t('Back to Bedi Delivery', 'العودة لبدي للتوصيل')}</span>
              </Link>

              <div className="my-2 border-t border-slate-800/60 mx-2"></div>

              {(hasNoProfileYet ? NAV_ITEMS.filter((i) => i.href === '/driver/profile') : NAV_ITEMS).map((item) => {
                const isActive = pathname === item.href
                return (
                  <button
                    key={item.href}
                    type="button"
                    className={`flex w-full items-center gap-4 px-4 py-3.5 rounded-2xl transition-colors text-left rtl:text-right ${
                      isActive 
                        ? 'bg-emerald-500/10 text-emerald-400' 
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                    onClick={() => {
                      setMenuOpen(false)
                      startTransition(() => {
                        router.push(item.href)
                      })
                    }}
                  >
                    <item.icon className={`size-6 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span className="font-medium text-[15px]">{navLabel(item)}</span>
                  </button>
                )
              })}

              <div className="my-2 border-t border-slate-800/60 mx-2"></div>

              {!isStandaloneMode() && <PWAReinstallHelp config={getDriverPWAConfig()} variant="menuitem" className="mx-1" />}

              {!hasNoProfileYet && <DriverInviteInMenu />}
              {!hasNoProfileYet && <DriverSidebarActions />}
            </div>

            <div className="mt-4 px-4 border-t border-slate-800/60 pt-4 mx-3">
              <DriverSignOutButton onClose={() => setMenuOpen(false)} />
            </div>
          </nav>
        </SheetContent>
      </Sheet>

      <main className="mx-auto max-w-lg px-4 py-4 sm:py-6 sm:max-w-[100vw] overflow-visible">
        <PWAManager role="driver" variant="inline" hideInstall />
        {pathname !== '/driver/profile' && (
          <>
            <DriverPushSetup />
            <DriverLocationSetup />
          </>
        )}
        <DriverOrdersGate>
          <DriverPullToRefresh>
            {children}
          </DriverPullToRefresh>
        </DriverOrdersGate>
        <DriverPushStatusCard />
      </main>
    </div>
    </DriverStatusProvider>
    </DriverPushProvider>
  )
}
