'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useUser } from '@clerk/nextjs'
import { useLanguage } from '@/components/LanguageContext'
import { PREFER_DRIVER_KEY, PREFER_TENANT_KEY } from '@/components/StandaloneDriverRedirect'
import { LayoutDashboard, UserPlus, LogIn, ArrowRight } from 'lucide-react'
import { PWAStoreBadgePair, type PWAAppKind } from '@/components/home/PWAStoreBadgePair'
import { PWAUninstallScopeDialog } from '@/components/home/PWAUninstallScopeDialog'

type MeContext = { tenants: { slug: string; name?: string }[]; isDriver: boolean }

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.06 },
  },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.2, 0, 0, 1] as const },
  },
}

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

/** M3 filled — primary (business). Full width + taller tap area on small screens. */
const m3Filled =
  'inline-flex w-full min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold shadow-[var(--m3-elevation-1)] transition-[transform,box-shadow,opacity] duration-[var(--m3-duration-short)] ease-[var(--m3-ease-standard)] hover:shadow-[var(--m3-elevation-2)] active:scale-[0.98] bg-[var(--m3-primary)] text-[var(--m3-on-primary)] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m3-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 touch-manipulation sm:min-h-10 sm:w-auto sm:py-2.5'

const m3FilledCustomer =
  'inline-flex w-full min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold shadow-[var(--m3-elevation-1)] transition-[transform,box-shadow,background-color] duration-[var(--m3-duration-short)] ease-[var(--m3-ease-standard)] hover:shadow-[var(--m3-elevation-2)] active:scale-[0.98] bg-slate-100 text-slate-900 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 touch-manipulation sm:min-h-10 sm:w-auto sm:py-2.5'

/** Driver brand red (matches driver PWA / marketing). */
const m3FilledDriver =
  'inline-flex w-full min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold shadow-[var(--m3-elevation-1)] transition-[transform,box-shadow,background-color] duration-[var(--m3-duration-short)] ease-[var(--m3-ease-standard)] hover:shadow-[var(--m3-elevation-2)] active:scale-[0.98] bg-[#9c2d2a] text-white hover:bg-[#b83834] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 touch-manipulation sm:min-h-10 sm:w-auto sm:py-2.5'

const m3Outlined =
  'inline-flex w-full min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-high)] px-4 py-3 text-sm font-bold text-[var(--m3-on-surface)] transition-colors duration-[var(--m3-duration-short)] ease-[var(--m3-ease-standard)] hover:bg-[var(--m3-surface-container-low)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m3-outline)] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 touch-manipulation sm:min-h-10 sm:w-auto sm:py-2.5'

const m3Card =
  'flex h-full flex-col rounded-3xl border border-zinc-700/70 bg-zinc-900/85 px-5 py-6 shadow-[var(--m3-elevation-2)] backdrop-blur-sm sm:rounded-2xl md:px-5 md:py-5'

export function HomePageAuthSections() {
  const { t, lang } = useLanguage()
  const isRtl = lang === 'ar'
  const { isSignedIn, isLoaded: clerkLoaded } = useUser()
  const [meContext, setMeContext] = useState<MeContext | null>(null)
  const [pwaModalApp, setPwaModalApp] = useState<PWAAppKind | null>(null)

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

  const hasTenant = (meContext?.tenants.length ?? 0) > 0
  const hasDriver = meContext?.isDriver === true
  const contextReady = !isSignedIn || meContext !== null
  const showSignedInBusiness = Boolean(isSignedIn && contextReady && hasTenant)
  const showSignedInDriver = Boolean(isSignedIn && contextReady && hasDriver)

  return (
    <section
      className="mt-12 pb-12 md:mt-16 md:pb-16"
      aria-label={t('For businesses and drivers', 'للأعمال والسائقين')}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <PWAUninstallScopeDialog
        open={pwaModalApp !== null}
        onOpenChange={(open) => {
          if (!open) setPwaModalApp(null)
        }}
        app={pwaModalApp}
      />
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        variants={container}
        className="mx-auto max-w-6xl scroll-mt-20"
      >
        <motion.div variants={item} className="mb-8 px-1 text-center md:mb-8 md:px-0">
          <h2 className="text-2xl font-bold tracking-tight text-[#E6E1E5] md:text-3xl">
            {t('Grow with Bedi', 'انمُ مع بدي')}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#CAC4D0] md:mt-2 md:text-base">
            {t(
              'Run your business online or deliver orders — same account, one platform.',
              'أدر عملك أونلاين أو وصّل الطلبات — نفس الحساب، منصة واحدة.'
            )}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 md:gap-4">
          {/* Customer */}
          <motion.article variants={item} id="for-customers" className={m3Card}>
            <div className="mb-5 flex flex-col items-center gap-3 text-center max-md:pb-1 md:mb-4 md:flex-row md:items-center md:gap-4 md:text-start">
              <div
                className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black ring-1 ring-white/20 md:h-[4.5rem] md:w-[4.5rem]"
                aria-hidden
              >
                <Image
                  src="/customersLogo.webp"
                  alt=""
                  width={72}
                  height={72}
                  className="object-cover"
                  sizes="(max-width:768px) 56px, 72px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-[#E6E1E5] md:text-xl">{t('For customers', 'للزبائن')}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#CAC4D0] md:mt-1 md:text-sm">
                  {t('Order from restaurants and stores.', 'اطلب من المطاعم والمتاجر.')}
                </p>
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap sm:gap-2">
              {!clerkLoaded ? (
                <div className="h-11 flex-1 animate-pulse rounded-full bg-zinc-800 sm:h-10" />
              ) : !isSignedIn ? (
                <>
                  <Link href="/sign-up" className={m3FilledCustomer}>
                    <UserPlus className="size-4 shrink-0" aria-hidden />
                    {t('Sign up', 'تسجيل')}
                  </Link>
                  <Link href="/sign-in" className={m3Outlined}>
                    <LogIn className="size-4 shrink-0" aria-hidden />
                    {t('Sign in', 'دخول')}
                  </Link>
                </>
              ) : (
                <Link href="/profile" className={`${m3FilledCustomer} sm:w-auto`}>
                  <LayoutDashboard className="size-4 shrink-0" aria-hidden />
                  {t('My Account', 'حسابي')}
                  <ArrowRight className="size-4 shrink-0 opacity-90 rtl:rotate-180" aria-hidden />
                </Link>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-700/50 bg-zinc-950/35 p-4 max-md:mt-7 md:mt-5 md:border-0 md:border-t md:border-zinc-700/50 md:bg-transparent md:p-0 md:pt-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 md:mb-2">
                {t('Install the app', 'ثبّت التطبيق')}
              </p>
              <PWAStoreBadgePair
                href="/"
                apkUrl="/apps/customer/bedi.apk"
                appKind="customer"
                t={t}
                onStandaloneBlocked={setPwaModalApp}
              />
            </div>
          </motion.article>
          {/* Business */}
          <motion.article variants={item} id="for-businesses" className={m3Card}>
            <div className="mb-5 flex flex-col items-center gap-3 text-center max-md:pb-1 md:mb-4 md:flex-row md:items-center md:gap-4 md:text-start">
              <div
                className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black ring-1 ring-white/20 md:h-[4.5rem] md:w-[4.5rem]"
                aria-hidden
              >
                <Image
                  src="/adminslogo.webp"
                  alt=""
                  width={72}
                  height={72}
                  className="object-cover"
                  sizes="(max-width:768px) 56px, 72px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-[#E6E1E5] md:text-xl">{t('For businesses', 'للأعمال')}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#CAC4D0] md:mt-1 md:text-sm">
                  {t('Menu, orders, dine-in & delivery.', 'قائمة، طلبات، جلوس وتوصيل.')}
                </p>
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap sm:gap-2">
              {!clerkLoaded ? (
                <div className="h-11 flex-1 animate-pulse rounded-full bg-zinc-800 sm:h-10" />
              ) : !isSignedIn ? (
                <>
                  <Link href="/sign-up?redirect_url=/onboarding" className={m3Filled}>
                    <UserPlus className="size-4 shrink-0" aria-hidden />
                    {t('Sign up', 'تسجيل')}
                  </Link>
                  <Link href="/sign-in?redirect_url=/onboarding" className={m3Outlined}>
                    <LogIn className="size-4 shrink-0" aria-hidden />
                    {t('Sign in', 'دخول')}
                  </Link>
                </>
              ) : !contextReady ? (
                <div className="h-11 flex-1 animate-pulse rounded-full bg-zinc-800 sm:h-10" />
              ) : showSignedInBusiness ? (
                <Link href="/dashboard" onClick={preferTenant} className={`${m3Filled} sm:w-auto`}>
                  <LayoutDashboard className="size-4 shrink-0" aria-hidden />
                  {t('Business dashboard', 'لوحة الأعمال')}
                  <ArrowRight className="size-4 shrink-0 opacity-90 rtl:rotate-180" aria-hidden />
                </Link>
              ) : (
                <Link href="/onboarding" onClick={preferTenant} className={`${m3Filled} sm:w-auto`}>
                  <UserPlus className="size-4 shrink-0" aria-hidden />
                  {t('Register your business', 'سجّل عملك')}
                  <ArrowRight className="size-4 shrink-0 opacity-90 rtl:rotate-180" aria-hidden />
                </Link>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-700/50 bg-zinc-950/35 p-4 max-md:mt-7 md:mt-5 md:border-0 md:border-t md:border-zinc-700/50 md:bg-transparent md:p-0 md:pt-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 md:mb-2">
                {t('Install the app', 'ثبّت التطبيق')}
              </p>
              <PWAStoreBadgePair
                href="/dashboard"
                apkUrl="/apps/tenant/bedi-tenant.apk"
                appKind="business"
                t={t}
                onBeforeNavigate={preferTenant}
                onStandaloneBlocked={setPwaModalApp}
              />
            </div>
          </motion.article>

          {/* Driver */}
          <motion.article variants={item} id="for-drivers" className={m3Card}>
            <div className="mb-5 flex flex-col items-center gap-3 text-center max-md:pb-1 md:mb-4 md:flex-row md:items-center md:gap-4 md:text-start">
              <div
                className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black ring-1 ring-white/20 md:h-[4.5rem] md:w-[4.5rem]"
                aria-hidden
              >
                <Image
                  src="/driversLogo.webp"
                  alt=""
                  width={72}
                  height={72}
                  className="object-cover"
                  sizes="(max-width:768px) 56px, 72px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-[#E6E1E5] md:text-xl">{t('For drivers', 'للسائقين')}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#CAC4D0] md:mt-1 md:text-sm">
                  {t('Deliver nearby and get paid.', 'وصّل في منطقتك واربح.')}
                </p>
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap sm:gap-2">
              {!clerkLoaded ? (
                <div className="h-11 flex-1 animate-pulse rounded-full bg-red-900/80 sm:h-10" />
              ) : !isSignedIn ? (
                <>
                  <Link href="/sign-up?redirect_url=/driver" className={m3FilledDriver}>
                    <UserPlus className="size-4 shrink-0" aria-hidden />
                    {t('Sign up', 'تسجيل')}
                  </Link>
                  <Link href="/sign-in?redirect_url=/driver" className={m3Outlined}>
                    <LogIn className="size-4 shrink-0" aria-hidden />
                    {t('Sign in', 'دخول')}
                  </Link>
                </>
              ) : !contextReady ? (
                <div className="h-11 flex-1 animate-pulse rounded-full bg-red-900/80 sm:h-10" />
              ) : showSignedInDriver ? (
                <Link href="/driver" onClick={preferDriver} className={`${m3FilledDriver} sm:w-auto`}>
                  <Image
                    src="/driversLogo.webp"
                    alt=""
                    width={16}
                    height={16}
                    className="size-4 shrink-0 object-contain drop-shadow-sm"
                    sizes="16px"
                  />
                  {t('Driver dashboard', 'لوحة السائق')}
                  <ArrowRight className="size-4 shrink-0 opacity-90 rtl:rotate-180" aria-hidden />
                </Link>
              ) : (
                <Link href="/driver/profile" onClick={preferDriver} className={`${m3FilledDriver} sm:w-auto`}>
                  <UserPlus className="size-4 shrink-0" aria-hidden />
                  {t('Complete driver signup', 'أكمل تسجيل السائق')}
                  <ArrowRight className="size-4 shrink-0 opacity-90 rtl:rotate-180" aria-hidden />
                </Link>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-700/50 bg-zinc-950/35 p-4 max-md:mt-7 md:mt-5 md:border-0 md:border-t md:border-zinc-700/50 md:bg-transparent md:p-0 md:pt-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 md:mb-2">
                {t('Install the app', 'ثبّت التطبيق')}
              </p>
              <PWAStoreBadgePair
                href="/driver"
                apkUrl="/apps/driver/bedi-driver.apk"
                appKind="driver"
                t={t}
                onBeforeNavigate={preferDriver}
                onStandaloneBlocked={setPwaModalApp}
              />
            </div>
          </motion.article>
        </div>
      </motion.div>
    </section>
  )
}
