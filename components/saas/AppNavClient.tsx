'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { UserButtonWithSignOutUrl } from '@/components/Auth/UserButtonWithSignOutUrl'
import { useLanguage } from '@/components/LanguageContext'
import { LayoutDashboard, Shield, Layout, Menu, Home, Truck, Download } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { PREFER_DRIVER_KEY, PREFER_TENANT_KEY } from '@/components/StandaloneDriverRedirect'

interface AppNavClientProps {
  variant: 'landing' | 'dashboard'
  showAdmin?: boolean
  hasDriver?: boolean
  signInLabel?: string
  getStartedLabel?: string
  trailingElement?: React.ReactNode
}

export function AppNavClient({ variant, showAdmin, hasDriver, signInLabel, getStartedLabel, trailingElement }: AppNavClientProps) {
  const [open, setOpen] = useState(false)
  const { lang, setLang, t } = useLanguage()
  const signIn = signInLabel ?? 'Sign in'
  const getStarted = getStartedLabel ?? 'Get started'

  const dashboardNavLabels = {
    dashboard: t('Dashboard', 'لوحة التحكم'),
    studio: t('Studio', 'استوديو'),
    admin: t('Admin', 'إدارة'),
    menu: t('Menu', 'القائمة'),
    account: t('Account', 'الحساب'),
    profileSignOut: t('Profile & sign out', 'الملف الشخصي وتسجيل الخروج'),
    switchToCustomer: t('Switch to Customer', 'التبديل إلى زبون'),
    switchToDriver: t('Switch to Driver', 'التبديل إلى سائق'),
  }

  const langSwitcher =
    variant === 'dashboard' ? (
      <div className="flex rounded-lg border border-slate-600 bg-slate-800/60 p-0.5">
        <button
          type="button"
          onClick={() => setLang('ar')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${lang === 'ar' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white'}`}
        >
          عربي
        </button>
        <button
          type="button"
          onClick={() => setLang('en')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${lang === 'en' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white'}`}
        >
          English
        </button>
      </div>
    ) : null

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/60 bg-slate-950/95 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 min-h-[56px] max-w-[100vw] items-center justify-between gap-2 px-4 sm:container sm:px-6">
          <Link
            href="/"
            className="flex min-w-0 shrink items-center gap-2 font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Image src="/logo.webp" alt="Bedi Delivery" width={32} height={32} className="h-8 w-auto shrink-0" />
            <span className="truncate text-lg tracking-tight">Bedi</span>
          </Link>

          {/* Desktop nav: visible from md up */}
          <nav className="hidden items-center gap-2 md:flex">
            {variant === 'dashboard' && langSwitcher}
            {trailingElement}
            {variant === 'landing' && (
              <>
                <span className="flex gap-2 md:hidden">
                  <Button asChild size="sm" className="border border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                    <Link href="/sign-in">{signIn}</Link>
                  </Button>
                  <Button asChild size="sm" className="bg-amber-500 text-slate-950 hover:bg-amber-400">
                    <Link href="/sign-up">{getStarted}</Link>
                  </Button>
                </span>
              </>
            )}
            {variant === 'dashboard' && (
              <>
                <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  <Link href="/dashboard">
                    <LayoutDashboard className="mr-1.5 size-4" />
                    {dashboardNavLabels.dashboard}
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  <Link
                    href="/"
                    onClick={() => { try { localStorage.removeItem(PREFER_DRIVER_KEY); localStorage.removeItem(PREFER_TENANT_KEY) } catch { /* ignore */ } }}
                  >
                    <Home className="mr-1.5 size-4" />
                    {dashboardNavLabels.switchToCustomer}
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-white" title="Download app">
                  <Link href="/download-app">
                    <Download className="mr-1.5 size-4" />
                    App
                  </Link>
                </Button>
                {hasDriver && (
                  <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                    <Link
                      href="/driver"
                      onClick={() => { try { localStorage.setItem(PREFER_DRIVER_KEY, '1') } catch { /* ignore */ } }}
                    >
                      <Truck className="mr-1.5 size-4" />
                      {dashboardNavLabels.switchToDriver}
                    </Link>
                  </Button>
                )}
                {showAdmin && (
                  <>
                    <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                      <Link href="/studio">
                        <Layout className="mr-1.5 size-4" />
                        {dashboardNavLabels.studio}
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-amber-400">
                      <Link href="/admin">
                        <Shield className="mr-1.5 size-4" />
                        {dashboardNavLabels.admin}
                      </Link>
                    </Button>
                  </>
                )}
                <UserButtonWithSignOutUrl />
              </>
            )}
          </nav>

          {/* Mobile: hamburger + user (dashboard) or sign in buttons (landing) */}
          <div className="flex items-center gap-1 md:hidden">
            {variant === 'landing' && (
              <>
                {trailingElement}
                <Button asChild size="sm" className="border border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                  <Link href="/sign-in">{signIn}</Link>
                </Button>
                <Button asChild size="sm" className="bg-amber-500 text-slate-950 hover:bg-amber-400">
                  <Link href="/sign-up">{getStarted}</Link>
                </Button>
              </>
            )}
            {variant === 'dashboard' && (
              <>
                {langSwitcher}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-slate-400 hover:text-white"
                  onClick={() => setOpen(true)}
                  aria-label={dashboardNavLabels.menu}
                >
                  <Menu className="size-6" />
                </Button>
                <UserButtonWithSignOutUrl />
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile menu sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={lang === 'ar' ? 'left' : 'right'}
          className="w-[min(100vw-2rem,320px)] border-slate-800 bg-slate-950 p-0 [&_button]:text-slate-400 [&_button]:hover:bg-slate-800 [&_button]:hover:text-white [&_button]:focus:ring-slate-700"
        >
          <SheetTitle className="sr-only">{dashboardNavLabels.menu}</SheetTitle>
          <nav className="flex flex-col py-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-6 py-3.5 text-slate-200 hover:bg-slate-800/80 hover:text-white"
              onClick={() => setOpen(false)}
            >
              <LayoutDashboard className="size-5 shrink-0" />
              {dashboardNavLabels.dashboard}
            </Link>
            <Link
              href="/"
              className="flex items-center gap-3 px-6 py-3.5 text-slate-200 hover:bg-slate-800/80 hover:text-white"
              onClick={() => { try { localStorage.removeItem(PREFER_DRIVER_KEY); localStorage.removeItem(PREFER_TENANT_KEY) } catch { /* ignore */ }; setOpen(false) }}
            >
              <Home className="size-5 shrink-0" />
              {dashboardNavLabels.switchToCustomer}
            </Link>
            <Link
              href="/download-app"
              className="flex items-center gap-3 px-6 py-3.5 text-slate-200 hover:bg-slate-800/80 hover:text-white"
              onClick={() => setOpen(false)}
            >
              <Download className="size-5 shrink-0" />
              Download App
            </Link>
            {hasDriver && (
              <Link
                href="/driver"
                className="flex items-center gap-3 px-6 py-3.5 text-slate-200 hover:bg-slate-800/80 hover:text-white"
                onClick={() => { try { localStorage.setItem(PREFER_DRIVER_KEY, '1') } catch { /* ignore */ }; setOpen(false) }}
              >
                <Truck className="size-5 shrink-0" />
                {dashboardNavLabels.switchToDriver}
              </Link>
            )}
            {showAdmin && (
              <>
                <Link
                  href="/studio"
                  className="flex items-center gap-3 px-6 py-3.5 text-slate-200 hover:bg-slate-800/80 hover:text-white"
                  onClick={() => setOpen(false)}
                >
                  <Layout className="size-5 shrink-0" />
                  {dashboardNavLabels.studio}
                </Link>
                <Link
                  href="/admin"
                  className="flex items-center gap-3 px-6 py-3.5 text-slate-200 hover:bg-slate-800/80 hover:text-amber-400"
                  onClick={() => setOpen(false)}
                >
                  <Shield className="size-5 shrink-0" />
                  {dashboardNavLabels.admin}
                </Link>
              </>
            )}
            <div className="mt-4 border-t border-slate-800 px-6 pt-4">
              <p className="text-xs text-slate-500">{dashboardNavLabels.account}</p>
              <div className="mt-2 flex items-center gap-2">
                <UserButtonWithSignOutUrl />
                <span className="text-sm text-slate-400">{dashboardNavLabels.profileSignOut}</span>
              </div>
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
