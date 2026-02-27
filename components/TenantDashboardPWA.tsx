'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Smartphone, Share2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'

const DISMISS_KEY = 'bedi-dashboard-pwa-dismissed'

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
  const [isStandalone, setIsStandalone] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const isRtl = lang === 'ar'

  useEffect(() => {
    setMounted(true)
    if (typeof window === 'undefined') return

    try {
      // Register SW so Android can show install prompt. When on manage, use tenant-scoped SW for separate PWA install.
      if ('serviceWorker' in navigator) {
        if (scope) {
          navigator.serviceWorker.register(`${scope}/sw.js`).catch(() => {})
        } else {
          navigator.serviceWorker.register('/app-sw.js', { scope: '/' }).catch(() => {})
        }
      }

      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
      setIsStandalone(standalone)

      try {
        const stored = sessionStorage.getItem(DISMISS_KEY)
        if (stored === '1') setDismissed(true)
      } catch {
        // sessionStorage can throw in private mode or when disabled
      }

      const ua = window.navigator.userAgent
      const ios = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: boolean }).MSStream
      setIsIOS(ios)

      const handler = (e: Event) => {
        try {
          setDeferredPrompt(e as unknown as BeforeInstallPromptEvent)
        } catch {
          // avoid uncaught errors in PWA install flow
        }
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    } catch {
      return undefined
    }
  }, [scope])

  const handleDismiss = () => {
    setDismissed(true)
    try {
      if (typeof window !== 'undefined') sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // sessionStorage can throw when disabled or in private mode
    }
  }

  const handleInstall = async () => {
    if (!deferredPrompt) return
    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setDismissed(true)
      }
    } catch {
      // PWA install can fail; avoid breaking the dashboard
    }
  }

  if (!mounted || isStandalone || dismissed) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25 }}
        className="mb-6 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-slate-900/90 p-5 shadow-lg"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
              <Smartphone className="size-6 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-white">
                {t('Install dashboard on your phone', 'ثبّت لوحة التحكم على هاتفك')}
              </h2>
              <p className="mt-0.5 text-sm text-slate-400">
                {t(
                  'Open the dashboard quickly from your home screen. Install the app below.',
                  'افتح لوحة التحكم بسرعة من الشاشة الرئيسية. ثبّت التطبيق أدناه.'
                )}
              </p>

              {/* Android: Install button or short instruction */}
              <div className="mt-4">
                {deferredPrompt ? (
                  <Button
                    onClick={handleInstall}
                    size="lg"
                    className="w-full gap-2 rounded-xl bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400 sm:w-auto"
                  >
                    <Download className="size-5" />
                    {t('Install on Android', 'التثبيت على أندرويد')}
                  </Button>
                ) : (
                  <p className="text-sm text-slate-400">
                    <strong className="text-slate-300">{t('Android:', 'أندرويد:')}</strong>{' '}
                    {t(
                      'Open this page on your Android phone in Chrome, then tap the menu (⋮) → "Install app" or "Add to Home screen".',
                      'افتح هذه الصفحة على هاتفك الأندرويد في Chrome، ثم اضغط القائمة (⋮) ← "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".'
                    )}
                  </p>
                )}
              </div>

              {/* iOS: Instructions */}
              {isIOS && (
                <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <p className="mb-3 font-semibold text-white">
                    {t('Install on iPhone / iPad (Safari)', 'التثبيت على iPhone / iPad (Safari)')}
                  </p>
                  <ol className="space-y-2.5 text-sm text-slate-300">
                    <li className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-white">
                        1
                      </span>
                      <span>
                        {t('Open this page in Safari (not Chrome).', 'افتح هذه الصفحة في Safari (وليس Chrome).')}
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-white">
                        2
                      </span>
                      <span>
                        {t('Tap the Share button at the bottom of Safari.', 'اضغط زر المشاركة في أسفل Safari.')}
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-white">
                        3
                      </span>
                      <span>
                        {t('Scroll and tap Add to Home Screen.', 'قم بالتمرير واضغط إضافة إلى الشاشة الرئيسية.')}
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-white">
                        4
                      </span>
                      <span>
                        {t('Tap Add to confirm.', 'اضغط إضافة للتأكيد.')}
                      </span>
                    </li>
                  </ol>
                </div>
              )}

              {!isIOS && deferredPrompt && (
                <p className="mt-3 text-xs text-slate-500">
                  {t(
                    "If the button doesn't appear, use your browser menu (⋮) → Install app / Add to Home screen.",
                    'إذا لم يظهر الزر، استخدم قائمة المتصفح (⋮) ← تثبيت التطبيق / إضافة إلى الشاشة الرئيسية.'
                  )}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="shrink-0 text-slate-400 hover:text-white"
            aria-label={t('Dismiss', 'إخفاء')}
          >
            <X className="size-5" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
