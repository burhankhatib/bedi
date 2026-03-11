'use client'

import { useEffect, useState, useCallback } from 'react'
import { Download, X, Smartphone, Share2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'

const DISMISS_KEY = 'bedi-orders-pwa-install-dismissed-until'
const DISMISS_HOURS_DEFAULT = 24
const DISMISS_HOURS_EXTENDED = 24 * 7

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/**
 * Registers the per-business Orders PWA SW and shows a native install banner.
 * On Android Chrome: captures beforeinstallprompt and shows a bottom banner.
 * On iOS Safari (non-standalone): shows Share → Add to Home Screen instructions.
 * Already-installed (standalone) users see nothing.
 */
export function OrdersPWASetup({ slug }: { slug: string }) {
  const { t, lang } = useLanguage()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [showFallbackHint, setShowFallbackHint] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [dismissedUntilMs, setDismissedUntilMs] = useState<number | null>(null)
  const isRtl = lang === 'ar'

  // Register SW
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !slug) return
    try {
      const scope = `/t/${slug}/orders`
      navigator.serviceWorker.register(`/t/${slug}/orders/sw.js`, { scope }).catch(() => {})
    } catch {
      // avoid uncaught errors
    }
  }, [slug])

  // Capture native install prompt (Android/Desktop) and reveal softly.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) return

    try {
      const until = localStorage.getItem(DISMISS_KEY)
      if (until) {
        const ms = parseInt(until, 10)
        if (!Number.isNaN(ms)) setDismissedUntilMs(ms)
      }
    } catch {
      // ignore
    }

    const ua = navigator.userAgent
    setIsDesktop(!/Android|iPhone|iPad|iPod|Mobile/i.test(ua))

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    let revealed = false
    const reveal = () => {
      if (revealed) return
      revealed = true
      setShowPrompt(true)
    }
    const onScroll = () => {
      if (window.scrollY > 240) reveal()
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('scroll', onScroll, { passive: true })
    const timer = setTimeout(reveal, 12000)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  // iOS Safari: allow manual instructions when not standalone
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) return
    if (!isIOS()) return

    let revealed = false
    const reveal = () => {
      if (revealed) return
      revealed = true
      setShowPrompt(true)
    }
    const onScroll = () => {
      if (window.scrollY > 240) reveal()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    const timer = setTimeout(reveal, 12000)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) {
      setShowFallbackHint(true)
      setTimeout(() => setShowFallbackHint(false), 4500)
      return
    }
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowPrompt(false)
        setDeferredPrompt(null)
      }
    } finally {
      setInstalling(false)
    }
  }, [deferredPrompt])

  const handleDismiss = useCallback((forHours: number = DISMISS_HOURS_DEFAULT) => {
    const until = Date.now() + forHours * 60 * 60 * 1000
    try { localStorage.setItem(DISMISS_KEY, String(until)) } catch { /* ignore */ }
    setDismissedUntilMs(until)
    setShowPrompt(false)
    setDeferredPrompt(null)
  }, [])

  const now = typeof window !== 'undefined' ? Date.now() : 0
  const dismissExpired = dismissedUntilMs === null || now >= dismissedUntilMs
  const ios = isIOS()

  if (!showPrompt || !dismissExpired || isStandalone()) return null

  return (
    <div
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 md:inset-x-auto md:end-4 md:w-[420px]"
      role="dialog"
      aria-label={t('Install business app', 'تثبيت تطبيق المتجر')}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="rounded-2xl border border-amber-500/30 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
            <Smartphone className="h-5 w-5 text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white">
              {t('Install this business app', 'ثبّت تطبيق هذا المتجر')}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {t('Get instant order alerts and one-tap launch from your Home Screen.', 'احصل على تنبيهات الطلبات فوراً وتشغيل سريع من الشاشة الرئيسية.')}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => handleDismiss(DISMISS_HOURS_DEFAULT)}
            aria-label={t('Dismiss', 'إغلاق')}
            className="shrink-0 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!ios && (
          <div className="space-y-2.5">
            <Button
              onClick={handleInstall}
              disabled={installing}
              className="w-full gap-2 bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400"
              size="lg"
            >
              <Download className="h-5 w-5 shrink-0" />
              {installing
                ? t('Installing…', 'جاري التثبيت…')
                : t('Install app', 'تثبيت التطبيق')}
            </Button>

            {showFallbackHint && (
              <p className="text-xs text-slate-400">
                {isDesktop
                  ? t('Use your browser install icon/menu to install this app.', 'استخدم أيقونة/قائمة التثبيت في المتصفح لتثبيت التطبيق.')
                  : t('Open browser menu (⋮) and choose Install app / Add to Home Screen.', 'افتح قائمة المتصفح (⋮) واختر تثبيت التطبيق / إضافة إلى الشاشة الرئيسية.')}
              </p>
            )}
          </div>
        )}

        {ios && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-sm text-amber-200">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">
                {t('iPhone / iPad install', 'تثبيت iPhone / iPad')}
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
              <ol className="space-y-2 text-xs text-amber-100/90">
                <li className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-900/70 text-[11px] font-bold">1</span>
                  <span>{t('Open this page in Safari.', 'افتح هذه الصفحة في Safari.')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-900/70 text-[11px] font-bold">2</span>
                  <span>{t('Tap', 'اضغط')} <Share2 className="inline h-3.5 w-3.5" /> {t('Share', 'مشاركة')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-900/70 text-[11px] font-bold">3</span>
                  <span>{t('Choose', 'اختر')} <Plus className="inline h-3.5 w-3.5" /> {t('Add to Home Screen', 'إضافة إلى الشاشة الرئيسية')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-900/70 text-[11px] font-bold">4</span>
                  <span>{t('Tap "Add".', 'اضغط "إضافة".')}</span>
                </li>
              </ol>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => handleDismiss(DISMISS_HOURS_EXTENDED)}
            className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-300"
          >
            {t("Don't show for 7 days", 'عدم الإظهار لمدة 7 أيام')}
          </button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleDismiss(DISMISS_HOURS_DEFAULT)}
            className="text-slate-300 hover:text-white"
          >
            {t('Not now', 'لاحقاً')}
          </Button>
        </div>
      </div>
    </div>
  )
}
