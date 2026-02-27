'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download, X, Share2, Plus, Smartphone, MapPin } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'

export function DriverPWAInstall() {
  const { t } = useLanguage()
  const [deferredPrompt, setDeferredPrompt] = useState<{ prompt: () => Promise<unknown> } | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showOnVisit, setShowOnVisit] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const standalone = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as unknown as { standalone?: boolean }).standalone === true
      setIsStandalone(standalone)
      const ua = window.navigator.userAgent
      const ios = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: boolean }).MSStream
      setIsIOS(ios)
      const handler = (e: Event) => {
        try {
          setDeferredPrompt(e as unknown as { prompt: () => Promise<unknown> })
        } catch {
          // avoid uncaught errors in PWA install flow
        }
      }
      window.addEventListener('beforeinstallprompt', handler)
      // On Android: show install card on visit after short delay (same as customer PWA)
      const delayMs = 1500
      const timer = setTimeout(() => setShowOnVisit(true), delayMs)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', handler)
      }
    } catch {
      return undefined
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    try {
      await deferredPrompt.prompt()
      setDeferredPrompt(null)
    } catch {
      // PWA install can fail; avoid breaking the driver page
    }
  }

  if (dismissed || isStandalone) return null
  if (!deferredPrompt && !isIOS && !showOnVisit) return null

  const title = t('Install the app', 'ثبّت التطبيق')
  const installBtn = t('Install', 'تثبيت')
  const dismissBtn = t('Dismiss', 'إخفاء')
  const fromThisPageNote = t('You’re on the right page. Installing from here gives you the Bedi Driver app.', 'أنت في الصفحة الصحيحة. التثبيت من هنا يعطيك تطبيق Bedi Driver.')

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/90 p-4 mb-4">
      <div className="flex items-start gap-2 rounded-lg bg-emerald-950/40 border border-emerald-600/40 p-2.5 mb-3">
        <MapPin className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" aria-hidden />
        <p className="text-sm text-emerald-200/95 font-medium">
          {fromThisPageNote}
        </p>
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white mb-2">{title}</p>
          {deferredPrompt ? (
            <p className="text-sm text-slate-400 mb-2">
              {t('Tap the button below to install on your device.', 'اضغط لتثبيت التطبيق على جهازك.')}
            </p>
          ) : isIOS ? (
            <div className="space-y-2 text-sm text-slate-400">
              <p className="font-semibold text-slate-300">
                {t('On iPhone/iPad (Safari):', 'على iPhone/iPad (Safari):')}
              </p>
              <ol className="space-y-1.5 list-none pl-0">
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-600 text-slate-200 text-xs font-bold">1</span>
                  <span className="flex flex-wrap items-center gap-1">
                    {t('Tap', 'اضغط')}
                    <span className="inline-flex items-center gap-1 rounded bg-slate-700 px-1.5 py-0.5 text-slate-200">
                      <Share2 className="h-3 w-3" />
                      {t('Share', 'مشاركة')}
                    </span>
                    {t('at the bottom', 'في الأسفل')}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-600 text-slate-200 text-xs font-bold">2</span>
                  <span className="flex flex-wrap items-center gap-1">
                    {t('Tap', 'اضغط')}
                    <span className="inline-flex items-center gap-1 rounded bg-slate-700 px-1.5 py-0.5 text-slate-200">
                      <Plus className="h-3 w-3" />
                      {t('Add to Home Screen', 'إضافة إلى الشاشة الرئيسية')}
                    </span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-600 text-slate-200 text-xs font-bold">3</span>
                  <span>{t('Tap "Add", then open from home screen', 'اضغط "إضافة" ثم افتح من الشاشة الرئيسية')}</span>
                </li>
              </ol>
              <div className="flex items-center gap-1.5 text-slate-500 pt-1">
                <Smartphone className="h-3.5 w-3.5" />
                <span className="text-xs">{t('iPhone and iPad', 'iPhone و iPad')}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 mb-2">
              {t('The install button will appear below, or use browser menu (⋮) → Install app.', 'سيظهر زر التثبيت أدناه، أو استخدم قائمة المتصفح (⋮) ← تثبيت التطبيق.')}
            </p>
          )}
          {deferredPrompt && (
            <Button
              size="sm"
              className="mt-2 bg-green-600 hover:bg-green-700 rounded-lg font-bold"
              onClick={handleInstall}
            >
              <Download className="ml-2 h-4 w-4" />
              {installBtn}
            </Button>
          )}
        </div>
        <Button variant="ghost" size="sm" className="shrink-0 text-slate-400" onClick={() => setDismissed(true)} aria-label={dismissBtn}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
