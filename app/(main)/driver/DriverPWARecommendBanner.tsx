'use client'

import { useState, useEffect } from 'react'
import { Download, Share2, Plus, Smartphone, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'

export function DriverPWARecommendBanner() {
  const { t } = useLanguage()
  const [mounted, setMounted] = useState(false)
  const [isStandalone, setIsStandalone] = useState(true)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<{ prompt: () => Promise<{ outcome: string }> } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const timer = setTimeout(() => {
      setMounted(true)
      try {
        const standalone =
          window.matchMedia('(display-mode: standalone)').matches ||
          (navigator as unknown as { standalone?: boolean }).standalone === true
        setIsStandalone(standalone)
        setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent))
      } catch {
        // ignore
      }
    }, 0)
    try {
      const handler = (e: Event) => {
        try {
          setDeferredPrompt(e as unknown as { prompt: () => Promise<{ outcome: string }> })
        } catch {
          // avoid uncaught errors in PWA install flow
        }
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', handler)
      }
    } catch {
      return () => clearTimeout(timer)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    try {
      await deferredPrompt.prompt()
      setDeferredPrompt(null)
    } catch {
      // PWA install can fail; avoid breaking the driver layout
    }
  }

  if (!mounted || isStandalone) return null

  const title = t('Recommended: Install the Driver app', 'مُوصى به: تثبيت تطبيق السائق')
  const reason = t('For the best experience and reliable push notifications, install the app on your device.', 'للحصول على أفضل تجربة وإشعارات موثوقة، ثبّت التطبيق على جهازك.')
  const fromThisAppNote = t('Install from the Orders page to get the correct Bedi Driver app.', 'ثبّت من صفحة طلبات التوصيل لتحصل على تطبيق Bedi Driver الصحيح.')
  const installBtn = t('Install app', 'تثبيت التطبيق')

  return (
    <div
      className="mb-4 rounded-xl border border-emerald-600/50 bg-emerald-950/30 p-4"
      role="region"
      aria-label={title}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 rounded-lg bg-emerald-900/30 border border-emerald-600/40 p-2 mb-1">
          <MapPin className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" aria-hidden />
          <p className="text-xs font-medium text-emerald-200/95">{fromThisAppNote}</p>
        </div>
        <div>
          <p className="font-semibold text-emerald-200 mb-1">{title}</p>
          <p className="text-xs text-emerald-200/90 mb-3">{reason}</p>
        </div>

        {isIOS ? (
          <div className="space-y-3 rounded-lg bg-emerald-900/20 p-3 border border-emerald-700/40">
            <p className="text-xs font-semibold text-emerald-200">
              {t('On iPhone/iPad (Safari):', 'على iPhone/iPad (Safari):')}
            </p>
            <ol className="space-y-2.5 text-xs text-emerald-200/90">
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600/50 text-emerald-100 font-bold">1</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {t('Tap the', 'اضغط على')}
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-800/60 px-2 py-0.5">
                    <Share2 className="h-3.5 w-3.5" />
                    {t('Share', 'مشاركة')}
                  </span>
                  {t('button at the bottom of Safari', 'في أسفل Safari')}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600/50 text-emerald-100 font-bold">2</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {t('Scroll and tap', 'قم بالتمرير واضغط على')}
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-800/60 px-2 py-0.5">
                    <Plus className="h-3.5 w-3.5" />
                    {t('Add to Home Screen', 'إضافة إلى الشاشة الرئيسية')}
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600/50 text-emerald-100 font-bold">3</span>
                <span>{t('Tap "Add", then open the app from your home screen', 'اضغط "إضافة"، ثم افتح التطبيق من الشاشة الرئيسية')}</span>
              </li>
            </ol>
            <div className="flex items-center gap-1.5 text-emerald-200/80 pt-1">
              <Smartphone className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">{t('Works on iPhone and iPad', 'يعمل على iPhone و iPad')}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-emerald-200/90">
            {t('Android: Tap Install below, or open the menu (⋮) → Add to Home screen.', 'Android: اضغط تثبيت أدناه، أو افتح القائمة (⋮) ← إضافة إلى الشاشة الرئيسية.')}
          </p>
        )}

        {deferredPrompt && (
          <Button
            size="sm"
            className="mt-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            onClick={handleInstall}
          >
            <Download className="ml-2 size-4 shrink-0" />
            {installBtn}
          </Button>
        )}
      </div>
    </div>
  )
}
