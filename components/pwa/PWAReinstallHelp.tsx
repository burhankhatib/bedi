'use client'

/**
 * Reinstall help for Driver and Tenant PWAs.
 * Shown when user is in standalone (installed PWA) mode — provides steps to uninstall and reinstall.
 */

import { useState } from 'react'
import { RefreshCw, ExternalLink, Copy, Check } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { isStandaloneMode } from '@/lib/pwa/detect'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { PWAConfig } from '@/lib/pwa/types'

interface PWAReinstallHelpProps {
  config: PWAConfig
  /** Optional class for the trigger button */
  className?: string
  /** Variant: 'link' (text link), 'icon' (icon button), or 'menuitem' (full nav row) */
  variant?: 'link' | 'icon' | 'menuitem'
}

function getInstallUrl(config: PWAConfig): string {
  if (typeof window === 'undefined') return ''
  const start = config.startUrl || config.scope || '/'
  return start.startsWith('http') ? start : `${window.location.origin}${start.replace(/\/$/, '')}`
}

export function PWAReinstallHelp({ config, className = '', variant = 'link' }: PWAReinstallHelpProps) {
  const { t, lang } = useLanguage()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const isRtl = lang === 'ar'
  const url = getInstallUrl(config)

  const copyUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  if (!isStandaloneMode()) return null

  const trigger = variant === 'menuitem' ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`flex w-full items-center gap-4 px-4 py-3.5 rounded-2xl text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors text-start ${className}`}
    >
      <RefreshCw className="size-6 shrink-0 text-slate-400" />
      <span className="font-medium text-[15px]">{t('Reinstall app', 'إعادة تثبيت التطبيق')}</span>
    </button>
  ) : variant === 'icon' ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors ${className}`}
      aria-label={t('Reinstall app help', 'مساعدة إعادة تثبيت التطبيق')}
    >
      <RefreshCw className="size-5" strokeWidth={2} />
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`text-sm text-slate-400 hover:text-white transition-colors ${className}`}
    >
      {t('Reinstall app', 'إعادة تثبيت التطبيق')}
    </button>
  )

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          dir={isRtl ? 'rtl' : 'ltr'}
          className="max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl"
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">
              {t('Reinstall', 'إعادة التثبيت')} {config.shortName}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-slate-400">
              {t(
                'If the app is acting up, try uninstalling and reinstalling. Follow these steps:',
                'إذا كان التطبيق يعمل بشكل غير صحيح، جرّب إلغاء التثبيت وإعادة التثبيت. اتبع الخطوات التالية:'
              )}
            </DialogDescription>
          </DialogHeader>
          <ol className="mt-6 space-y-3 text-sm text-slate-300">
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-700 font-bold text-slate-300">1</span>
              <span>
                {t('Long-press the app icon on your home screen.', 'اضغط مطولاً على أيقونة التطبيق على الشاشة الرئيسية.')}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-700 font-bold text-slate-300">2</span>
              <span>
                {t('Tap "Uninstall" or "Remove from Home screen".', 'اضغط "إلغاء التثبيت" أو "إزالة من الشاشة الرئيسية".')}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-700 font-bold text-slate-300">3</span>
              <span>
                {t('Open Chrome or Safari, go to the link below, and tap "Install" or "Add to Home screen".', 'افتح Chrome أو Safari، اذهب إلى الرابط أدناه، واضغط "تثبيت" أو "إضافة إلى الشاشة الرئيسية".')}
              </span>
            </li>
          </ol>
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 font-mono text-xs text-slate-300 break-all">
              {url}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyUrl}
                className="flex-1 gap-2 border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
              >
                {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                {copied ? t('Copied!', 'تم النسخ!') : t('Copy link', 'نسخ الرابط')}
              </Button>
              <Button
                size="sm"
                onClick={() => window.open(url, '_blank')}
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-500"
              >
                <ExternalLink className="size-4" />
                {t('Open in browser', 'فتح في المتصفح')}
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="mt-4 w-full text-slate-500 hover:text-slate-300"
          >
            {t('Close', 'إغلاق')}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
