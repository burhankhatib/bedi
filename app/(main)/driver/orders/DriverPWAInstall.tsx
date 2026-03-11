'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download, X, Share2, Plus, Smartphone, MapPin } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'

const DISMISS_KEY = 'bedi-driver-pwa-install-dismissed-until'
const DISMISS_HOURS_DEFAULT = 24
const DISMISS_HOURS_EXTENDED = 24 * 7

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function DriverPWAInstall() {
  const { t, lang } = useLanguage()
  const isRtl = lang === 'ar'

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [showFallbackHint, setShowFallbackHint] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [dismissedUntilMs, setDismissedUntilMs] = useState<number | null>(null)

  useEffect(() => {
    try {
      // Force driver manifest on driver pages so install always maps to Driver app.
      const targetManifest = '/driver/manifest.webmanifest'
      let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
      if (!link) {
        link = document.createElement('link')
        link.setAttribute('rel', 'manifest')
        document.head.appendChild(link)
      }
      if (link.getAttribute('href') !== targetManifest) {
        link.setAttribute('href', targetManifest)
      }

      const until = localStorage.getItem(DISMISS_KEY)
      if (until) {
        const ms = parseInt(until, 10)
        if (!Number.isNaN(ms)) setDismissedUntilMs(ms)
      }
    } catch {
      // ignore
    }
    const timer = setTimeout(() => {
      try {
        // Ensure a dedicated /driver/ SW controls this app context.
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/driver/sw.js', { scope: '/driver/' }).catch(() => {})
        }
        const standalone = window.matchMedia('(display-mode: standalone)').matches
          || (window.navigator as unknown as { standalone?: boolean }).standalone === true
        setIsStandalone(standalone)
        const ua = window.navigator.userAgent
        const ios = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: boolean }).MSStream
        const desktop = !/Android|iPhone|iPad|iPod|Mobile/i.test(ua)
        setIsIOS(ios)
        setIsDesktop(desktop)
      } catch {
        // ignore
      }
    }, 0)
    try {
      const handler = (e: Event) => {
        try {
          ;(e as Event & { preventDefault?: () => void }).preventDefault?.()
          setDeferredPrompt(e as BeforeInstallPromptEvent)
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
      const delayTimer = setTimeout(reveal, 12000)

      return () => {
        clearTimeout(timer)
        clearTimeout(delayTimer)
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('beforeinstallprompt', handler)
      }
    } catch {
      return () => clearTimeout(timer)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setShowFallbackHint(true)
      setTimeout(() => setShowFallbackHint(false), 4500)
      return
    }
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setShowPrompt(false)
      }
      setDeferredPrompt(null)
    } catch {
      // PWA install can fail; avoid breaking the driver page
    }
  }

  const now = typeof window !== 'undefined' ? Date.now() : 0
  const dismissExpired = dismissedUntilMs === null || now >= dismissedUntilMs

  const dismissPrompt = (forHours: number = DISMISS_HOURS_DEFAULT) => {
    const until = Date.now() + forHours * 60 * 60 * 1000
    setDismissedUntilMs(until)
    setShowPrompt(false)
    try {
      localStorage.setItem(DISMISS_KEY, String(until))
    } catch {
      // ignore
    }
  }

  if (isStandalone || !dismissExpired || !showPrompt) return null

  const title = t('Get Bedi Driver app', 'احصل على تطبيق Bedi Driver')
  const installBtn = t('Install app', 'تثبيت التطبيق')
  const fromThisPageNote = t('You’re on the right page. Installing from here gives you the Bedi Driver app.', 'أنت في الصفحة الصحيحة. التثبيت من هنا يعطيك تطبيق Bedi Driver.')

  return (
    <div
      className="mb-4 rounded-2xl border border-emerald-600/35 bg-gradient-to-br from-emerald-900/45 to-slate-900/90 p-4 shadow-lg"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="flex items-start gap-2 rounded-lg bg-emerald-950/40 border border-emerald-600/40 p-2.5 mb-3">
        <MapPin className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" aria-hidden />
        <p className="text-sm text-emerald-200/95 font-medium">
          {fromThisPageNote}
        </p>
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white mb-1">{title}</p>
          <p className="text-sm text-slate-300 mb-3">
            {t('Install for faster dispatch, better reliability, and quick app launch.', 'ثبّت التطبيق لاستقبال أسرع وموثوقية أعلى وفتح سريع.')}
          </p>
          {!isIOS && (
            <Button
              size="sm"
              className="bg-white text-emerald-900 hover:bg-emerald-50 rounded-lg font-bold"
              onClick={handleInstall}
            >
              <Download className="ml-2 h-4 w-4" />
              {installBtn}
            </Button>
          )}
          {!isIOS && showFallbackHint && (
            <p className="text-xs text-slate-400 mt-2">
              {isDesktop
                ? t('Use browser menu/address-bar install icon to install this app.', 'استخدم قائمة المتصفح/أيقونة التثبيت في شريط العنوان لتثبيت التطبيق.')
                : t('Open browser menu (⋮) and choose Install app / Add to Home Screen.', 'افتح قائمة المتصفح (⋮) واختر تثبيت التطبيق / إضافة إلى الشاشة الرئيسية.')}
            </p>
          )}
          {isIOS && (
            <div className="rounded-xl border border-slate-700/80 bg-slate-900/55 p-3 mt-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-200">
                  <Smartphone className="h-4 w-4" />
                  <p className="text-sm font-semibold">{t('iPhone / iPad install', 'تثبيت iPhone / iPad')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInstallHelp((v) => !v)}
                  className="text-xs text-emerald-300 underline underline-offset-2"
                >
                  {showInstallHelp ? t('Hide steps', 'إخفاء الخطوات') : t('Show steps', 'عرض الخطوات')}
                </button>
              </div>
              {showInstallHelp && (
                <ol className="mt-3 space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-200">1</span>
                    <span>{t('Open this page in Safari.', 'افتح هذه الصفحة في Safari.')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-200">2</span>
                    <span className="inline-flex items-center gap-1">{t('Tap', 'اضغط')} <Share2 className="h-3 w-3" /> {t('Share', 'مشاركة')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-200">3</span>
                    <span className="inline-flex items-center gap-1">{t('Choose', 'اختر')} <Plus className="h-3 w-3" /> {t('Add to Home Screen', 'إضافة إلى الشاشة الرئيسية')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-200">4</span>
                    <span>{t('Tap "Add", then open the app from your Home Screen.', 'اضغط "إضافة"، ثم افتح التطبيق من الشاشة الرئيسية.')}</span>
                  </li>
                </ol>
              )}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => dismissPrompt(DISMISS_HOURS_EXTENDED)}
              className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
            >
              {t("Don't show for 7 days", 'عدم الإظهار لمدة 7 أيام')}
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-white"
              onClick={() => dismissPrompt(DISMISS_HOURS_DEFAULT)}
            >
              {t('Not now', 'لاحقاً')}
            </Button>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0 text-slate-400" onClick={() => dismissPrompt(DISMISS_HOURS_DEFAULT)} aria-label={t('Dismiss', 'إخفاء')}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
