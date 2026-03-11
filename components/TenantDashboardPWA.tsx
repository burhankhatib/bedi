'use client'

import { useState, useEffect } from 'react'
import { Download, X, Smartphone, Share2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'

const DISMISS_KEY = 'bedi-dashboard-pwa-dismissed-until'
const DISMISS_HOURS_DEFAULT = 24
const DISMISS_HOURS_EXTENDED = 24 * 7

interface BeforeInstallPromptEvent extends Event {
  prompt: () => void
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface TenantDashboardPWAProps {
  /** When set (e.g. on /t/[slug]/manage), register SW with this scope so install uses tenant Dashboard PWA manifest */
  slug?: string
  scope?: string
}

export function TenantDashboardPWA({ slug, scope }: TenantDashboardPWAProps = {}) {
  const { t, lang } = useLanguage()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [showFallbackHint, setShowFallbackHint] = useState(false)
  const [dismissedUntilMs, setDismissedUntilMs] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const isRtl = lang === 'ar'

  useEffect(() => {
    setMounted(true)
    if (typeof window === 'undefined') return

    try {
      // Force the correct manifest for this context:
      // - /dashboard => unified Bedi Business
      // - /t/[slug]/manage => per-business app that starts at /orders
      const targetManifest = slug
        ? `/t/${slug}/orders/manifest.webmanifest`
        : '/dashboard/manifest.webmanifest'
      let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
      if (!link) {
        link = document.createElement('link')
        link.setAttribute('rel', 'manifest')
        document.head.appendChild(link)
      }
      if (link.getAttribute('href') !== targetManifest) {
        link.setAttribute('href', targetManifest)
      }

      // Register SW so Android can show install prompt. When on manage, use tenant-scoped SW for separate PWA install.
      if ('serviceWorker' in navigator) {
        if (scope) {
          const normalized = scope.endsWith('/') ? scope : `${scope}/`
          navigator.serviceWorker.register(`${normalized.replace(/\/$/, '')}/sw.js`, { scope: normalized }).catch(() => {})
        } else {
          navigator.serviceWorker.register('/app-sw.js', { scope: '/' }).catch(() => {})
        }
      }

      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
      setIsStandalone(standalone)

      try {
        const until = localStorage.getItem(DISMISS_KEY)
        if (until) {
          const ms = parseInt(until, 10)
          if (!Number.isNaN(ms)) setDismissedUntilMs(ms)
        }
      } catch {
        // localStorage can throw in private mode or when disabled
      }

      const ua = window.navigator.userAgent
      const ios = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: boolean }).MSStream
      const desktop = !/Android|iPhone|iPad|iPod|Mobile/i.test(ua)
      setIsIOS(ios)
      setIsDesktop(desktop)

      const handler = (e: Event) => {
        try {
          ;(e as Event & { preventDefault?: () => void }).preventDefault?.()
          setDeferredPrompt(e as unknown as BeforeInstallPromptEvent)
        } catch {
          // avoid uncaught errors in PWA install flow
        }
      }
      window.addEventListener('beforeinstallprompt', handler)

      let revealed = false
      const reveal = () => {
        if (revealed) return
        revealed = true
        setShowPrompt(true)
      }
      const onScroll = () => {
        if (window.scrollY > 220) reveal()
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      const timer = setTimeout(reveal, 12000)

      return () => {
        clearTimeout(timer)
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('beforeinstallprompt', handler)
      }
    } catch {
      return undefined
    }
  }, [scope])

  const handleDismiss = (forHours: number = DISMISS_HOURS_DEFAULT) => {
    const until = Date.now() + forHours * 60 * 60 * 1000
    setDismissedUntilMs(until)
    setShowPrompt(false)
    try {
      if (typeof window !== 'undefined') localStorage.setItem(DISMISS_KEY, String(until))
    } catch {
      // localStorage can throw when disabled or in private mode
    }
  }

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setShowFallbackHint(true)
      setTimeout(() => setShowFallbackHint(false), 4500)
      return
    }
    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setShowPrompt(false)
      }
    } catch {
      // PWA install can fail; avoid breaking the dashboard
    }
  }

  const now = typeof window !== 'undefined' ? Date.now() : 0
  const dismissExpired = dismissedUntilMs === null || now >= dismissedUntilMs

  if (!mounted || isStandalone || !dismissExpired || !showPrompt) return null

  return (
      <div className="mb-6 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-slate-900/90 p-5 shadow-lg" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
              <Smartphone className="size-6 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-white">
                {t('Install your business dashboard app', 'ثبّت تطبيق لوحة التحكم')}
              </h2>
              <p className="mt-0.5 text-sm text-slate-400">
                {t(
                  'Open your dashboard in one tap with better reliability and notifications.',
                  'افتح لوحة التحكم بلمسة واحدة مع موثوقية أعلى وإشعارات أفضل.'
                )}
              </p>

              {!isIOS && (
                <div className="mt-4">
                  <Button
                    onClick={handleInstall}
                    size="lg"
                    className="w-full gap-2 rounded-xl bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400 sm:w-auto"
                  >
                    <Download className="size-5" />
                    {t('Install dashboard app', 'تثبيت تطبيق لوحة التحكم')}
                  </Button>
                  {showFallbackHint && (
                    <p className="mt-2 text-xs text-slate-400">
                      {isDesktop
                        ? t('Use your browser install icon/menu to install this app.', 'استخدم أيقونة/قائمة التثبيت في المتصفح لتثبيت التطبيق.')
                        : t('Open browser menu (⋮) and choose Install app / Add to Home screen.', 'افتح قائمة المتصفح (⋮) واختر تثبيت التطبيق / إضافة إلى الشاشة الرئيسية.')}
                    </p>
                  )}
                </div>
              )}

              {/* iOS: Instructions */}
              {isIOS && (
                <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="font-semibold text-white">
                      {t('Install on iPhone / iPad', 'التثبيت على iPhone / iPad')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowInstallHelp((v) => !v)}
                      className="text-xs text-amber-300 underline underline-offset-2"
                    >
                      {showInstallHelp ? t('Hide steps', 'إخفاء الخطوات') : t('Show steps', 'عرض الخطوات')}
                    </button>
                  </div>
                  {showInstallHelp && (
                  <ol className="space-y-2.5 text-sm text-slate-300">
                    <li className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-white">
                        1
                      </span>
                      <span>
                        {t('Open this page in Safari.', 'افتح هذه الصفحة في Safari.')}
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-white">
                        2
                      </span>
                      <span>
                        {t('Tap', 'اضغط')} <Share2 className="inline h-3.5 w-3.5" /> {t('Share', 'مشاركة')}.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-white">
                        3
                      </span>
                      <span>
                        {t('Choose', 'اختر')} <Plus className="inline h-3.5 w-3.5" /> {t('Add to Home Screen', 'إضافة إلى الشاشة الرئيسية')}.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-white">
                        4
                      </span>
                      <span>
                        {t('Tap "Add", then open the app from your Home Screen.', 'اضغط "إضافة"، ثم افتح التطبيق من الشاشة الرئيسية.')}
                      </span>
                    </li>
                  </ol>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleDismiss(DISMISS_HOURS_EXTENDED)}
                  className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-200"
                >
                  {t("Don't show for 7 days", 'عدم الإظهار لمدة 7 أيام')}
                </button>
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white" onClick={() => handleDismiss(DISMISS_HOURS_DEFAULT)}>
                  {t('Not now', 'لاحقاً')}
                </Button>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDismiss(DISMISS_HOURS_DEFAULT)}
            className="shrink-0 text-slate-400 hover:text-white"
            aria-label={t('Dismiss', 'إخفاء')}
          >
            <X className="size-5" />
          </Button>
        </div>
      </div>
  )
}
