'use client'

/**
 * PWA Install Icon – Subtle header icon that triggers install flow.
 * Shows when: !isStandalone && (canInstall || isIOS) && dismissExpired.
 * Android: click triggers native install. iOS: click shows Add to Home Screen instructions.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Smartphone, Share2, Plus } from 'lucide-react'
import { usePWA } from '@/lib/pwa/use-pwa'
import { useLanguage } from '@/components/LanguageContext'
import { getIOSInstallSteps, getIOSLabels } from '@/lib/pwa/detect'
import type { PWAConfig } from '@/lib/pwa/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface PWAInstallIconProps {
  config: PWAConfig
  /** Optional class for theming (e.g. light/dark header) */
  className?: string
}

export function PWAInstallIcon({ config, className = '' }: PWAInstallIconProps) {
  const { t, lang } = useLanguage()
  const pwa = usePWA(config)
  const { os, installPrompt } = pwa
  const [showIOSHelp, setShowIOSHelp] = useState(false)
  const [showDesktopHelp, setShowDesktopHelp] = useState(false)

  const { canInstall, dismissExpired, triggerInstall, installing } = installPrompt
  const isRtl = lang === 'ar'
  const steps = getIOSInstallSteps(lang === 'ar' ? 'ar' : 'en')
  const labels = getIOSLabels(lang === 'ar' ? 'ar' : 'en')

  // In development, always show so developers can test (bypass dismiss)
  const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'
  const effectiveDismissExpired = isDev || dismissExpired

  // Show on mobile (Android/iOS) when installable, and on desktop for discoverability (browser install hint)
  const visible =
    !os.isStandalone &&
    effectiveDismissExpired &&
    (canInstall || os.isIOS || os.isDesktop)

  const handleClick = () => {
    if (os.isIOS) {
      setShowIOSHelp(true)
    } else if (os.isDesktop) {
      setShowDesktopHelp(true)
    } else {
      triggerInstall()
    }
  }

  if (!visible) return null

  return (
    <>
      <motion.button
        type="button"
        onClick={handleClick}
        disabled={installing}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`
          flex h-9 w-9 shrink-0 items-center justify-center rounded-full
          bg-emerald-500/20 text-emerald-600 ring-2 ring-emerald-400/30
          hover:bg-emerald-500/30 hover:ring-emerald-400/50
          transition-colors duration-200
          ${className}
        `}
        aria-label={t('Install app', 'تثبيت التطبيق')}
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          <Smartphone className="h-5 w-5" strokeWidth={2.5} />
          <span
            className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30"
            style={{ animationDuration: '2s' }}
            aria-hidden
          />
        </span>
      </motion.button>

      <Dialog open={showDesktopHelp} onOpenChange={setShowDesktopHelp}>
        <DialogContent
          dir={isRtl ? 'rtl' : 'ltr'}
          className="max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {t(`Install ${config.shortName}`, `تثبيت ${config.shortName}`)}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 mt-1">
              {t(
                'Look for the install icon in your browser\'s address bar, or open the menu (⋮) and choose "Install app" or "Add to Home screen".',
                'ابحث عن أيقونة التثبيت في شريط عنوان المتصفح، أو افتح القائمة (⋮) واختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".'
              )}
            </DialogDescription>
          </DialogHeader>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDesktopHelp(false)}
            className="mt-4 w-full"
          >
            {t('Got it', 'فهمت')}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showIOSHelp} onOpenChange={setShowIOSHelp}>
        <DialogContent
          dir={isRtl ? 'rtl' : 'ltr'}
          className="max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {t(`Add ${config.shortName} to Home Screen`, `إضافة ${config.shortName} إلى الشاشة الرئيسية`)}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 mt-1">
              {t('Follow these steps to install the app on your iPhone or iPad.', 'اتبع هذه الخطوات لتثبيت التطبيق على جهازك.')}
            </DialogDescription>
          </DialogHeader>
          <ol className="mt-4 space-y-3 text-sm text-slate-700">
            {steps.map((step) => (
              <li key={step.number} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">
                  {step.number}
                </span>
                <span className="pt-0.5">
                  {step.text}
                  {step.icon === 'share' && (
                    <span className="inline-flex items-center gap-1 ms-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium">
                      <Share2 className="size-3.5" />
                      {labels.share}
                    </span>
                  )}
                  {step.icon === 'plus' && (
                    <span className="inline-flex items-center gap-1 ms-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium">
                      <Plus className="size-3.5" />
                      {labels.addToHomeScreen}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowIOSHelp(false)}
            className="mt-4 w-full"
          >
            {t('Got it', 'فهمت')}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
