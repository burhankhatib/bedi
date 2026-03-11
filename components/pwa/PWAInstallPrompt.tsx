'use client'

/**
 * PWA Install Prompt – Unified Component
 * Handles Android native install, iOS Add to Home Screen instructions,
 * and Desktop browser install hints. Fully configurable via PWAConfig.
 */

import { useState } from 'react'
import { Download, X, Smartphone, Share2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'
import type { PWAConfig, OSInfo, InstallPromptState } from '@/lib/pwa/types'
import { getIOSInstallSteps, getIOSLabels } from '@/lib/pwa/detect'

interface PWAInstallPromptProps {
  config: PWAConfig
  os: OSInfo
  installPrompt: InstallPromptState
  /** 'fixed' = floating bottom sheet (customers), 'inline' = embedded card (business/driver) */
  variant?: 'fixed' | 'inline'
}

export function PWAInstallPrompt({
  config,
  os,
  installPrompt,
  variant = 'fixed',
}: PWAInstallPromptProps) {
  const { t, lang } = useLanguage()
  const isRtl = lang === 'ar'
  const [showInstallHelp, setShowInstallHelp] = useState(false)

  if (!installPrompt.showPrompt) return null

  const steps = getIOSInstallSteps(lang === 'ar' ? 'ar' : 'en')
  const labels = getIOSLabels(lang === 'ar' ? 'ar' : 'en')

  // ── Fixed variant (floating bottom sheet for customers) ──────────────────
  if (variant === 'fixed') {
    return (
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[90] md:inset-x-auto md:end-4 md:bottom-4 md:w-[420px]"
        style={{ touchAction: 'manipulation' }}
      >
        <div className="rounded-2xl border border-emerald-300/40 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-4 shadow-xl shadow-emerald-900/25">
          <div className="mb-3 flex items-start gap-3">
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/20 p-1">
              <img src={config.icon} alt="" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-black text-white">
                {t(`Get ${config.shortName} on your device`, `احصل على ${config.shortName} على جهازك`)}
              </h3>
              <p className="mt-0.5 text-xs leading-snug text-emerald-100">
                {t(
                  'Faster access from home screen, smoother checkout, and real-time updates.',
                  'وصول أسرع من الشاشة الرئيسية، وتجربة طلب أسلس، وتحديثات مباشرة.'
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={installPrompt.dismiss}
              className="shrink-0 rounded-lg bg-white/15 text-white hover:bg-white/25 hover:text-white"
              aria-label={t('Close', 'إغلاق')}
            >
              <X className="size-4" />
            </Button>
          </div>

          {os.isIOS ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-xl border border-white/20 bg-white/10 px-3 py-2">
                <div className="flex items-center gap-2 text-emerald-100">
                  <Smartphone className="size-4" />
                  <span className="text-xs font-semibold">{t('iPhone / iPad install', 'تثبيت iPhone / iPad')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInstallHelp((v) => !v)}
                  className="text-xs font-semibold text-white underline underline-offset-2"
                >
                  {showInstallHelp ? t('Hide steps', 'إخفاء الخطوات') : t('Show steps', 'عرض الخطوات')}
                </button>
              </div>
              {showInstallHelp && (
                <ol className="space-y-2 rounded-xl border border-white/20 bg-white/10 p-3 text-xs text-emerald-100">
                  {steps.map((step) => (
                    <li key={step.number} className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-white">
                        {step.number}
                      </span>
                      <span>
                        {step.text}
                        {step.icon === 'share' && (
                          <span className="inline-flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 text-white ms-1">
                            <Share2 className="size-3.5" />
                            {labels.share}
                          </span>
                        )}
                        {step.icon === 'plus' && (
                          <span className="inline-flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 text-white ms-1">
                            <Plus className="size-3.5" />
                            {labels.addToHomeScreen}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={installPrompt.triggerInstall}
                disabled={installPrompt.installing}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-emerald-800 shadow-md transition-colors hover:bg-emerald-50"
              >
                <Download className="size-4.5 shrink-0" />
                <span className="font-bold">
                  {installPrompt.installing
                    ? t('Installing…', 'جاري التثبيت…')
                    : t('Install app', 'تثبيت التطبيق')}
                </span>
              </button>
              {installPrompt.showFallbackHint && (
                <p className="text-center text-xs text-emerald-100">
                  {os.isDesktop
                    ? t('Use your browser menu to install this app (e.g. address bar install icon).', 'استخدم قائمة المتصفح لتثبيت التطبيق (مثل أيقونة التثبيت في شريط العنوان).')
                    : t('Open browser menu (⋮) and choose Install app / Add to Home screen.', 'افتح قائمة المتصفح (⋮) واختر تثبيت التطبيق / إضافة إلى الشاشة الرئيسية.')}
                </p>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-white/20 pt-2">
            <button
              type="button"
              onClick={installPrompt.dismissExtended}
              className="text-xs text-emerald-100 underline underline-offset-2 hover:text-white"
            >
              {t("Don't show for 7 days", 'عدم الإظهار لمدة 7 أيام')}
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={installPrompt.dismiss}
              className="border-white/30 bg-white/15 text-white hover:bg-white/25 hover:text-white"
            >
              {t('Not now', 'لاحقاً')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Inline variant (embedded card for business/driver dashboards) ────────
  return (
    <div
      className="mb-6 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-slate-900/90 p-5 shadow-lg"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 overflow-hidden p-1">
            <img src={config.icon} alt="" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-white">
              {t(`Install ${config.shortName} app`, `ثبّت تطبيق ${config.shortName}`)}
            </h2>
            <p className="mt-0.5 text-sm text-slate-400">
              {t(
                'Open your dashboard in one tap with better reliability and notifications.',
                'افتح لوحة التحكم بلمسة واحدة مع موثوقية أعلى وإشعارات أفضل.'
              )}
            </p>

            {!os.isIOS && (
              <div className="mt-4">
                <Button
                  onClick={installPrompt.triggerInstall}
                  disabled={installPrompt.installing}
                  size="lg"
                  className="w-full gap-2 rounded-xl bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400 sm:w-auto"
                >
                  <Download className="size-5" />
                  {installPrompt.installing
                    ? t('Installing…', 'جاري التثبيت…')
                    : t('Install app', 'تثبيت التطبيق')}
                </Button>
                {installPrompt.showFallbackHint && (
                  <p className="mt-2 text-xs text-slate-400">
                    {os.isDesktop
                      ? t('Use your browser install icon/menu to install this app.', 'استخدم أيقونة/قائمة التثبيت في المتصفح لتثبيت التطبيق.')
                      : t('Open browser menu (⋮) and choose Install app / Add to Home screen.', 'افتح قائمة المتصفح (⋮) واختر تثبيت التطبيق / إضافة إلى الشاشة الرئيسية.')}
                  </p>
                )}
              </div>
            )}

            {os.isIOS && (
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
                    {steps.map((step) => (
                      <li key={step.number} className="flex gap-3">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-bold text-white">
                          {step.number}
                        </span>
                        <span>
                          {step.text}
                          {step.icon === 'share' && <Share2 className="inline h-3.5 w-3.5 mx-1" />}
                          {step.icon === 'share' && labels.share}
                          {step.icon === 'plus' && <Plus className="inline h-3.5 w-3.5 mx-1" />}
                          {step.icon === 'plus' && labels.addToHomeScreen}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={installPrompt.dismissExtended}
                className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-200"
              >
                {t("Don't show for 7 days", 'عدم الإظهار لمدة 7 أيام')}
              </button>
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white" onClick={installPrompt.dismiss}>
                {t('Not now', 'لاحقاً')}
              </Button>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={installPrompt.dismiss}
          className="shrink-0 text-slate-400 hover:text-white"
          aria-label={t('Dismiss', 'إخفاء')}
        >
          <X className="size-5" />
        </Button>
      </div>
    </div>
  )
}
