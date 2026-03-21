'use client'

import { useState } from 'react'
import { ExternalLink, Copy, Check } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { PWAAppKind } from '@/components/home/PWAStoreBadgePair'

function getInstallUrl(app: PWAAppKind): string {
  if (typeof window === 'undefined') return ''
  const path = app === 'driver' ? '/driver' : '/dashboard'
  return `${window.location.origin}${path}`
}

export function PWAUninstallScopeDialog({
  open,
  onOpenChange,
  app,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  app: PWAAppKind | null
}) {
  const { t, lang } = useLanguage()
  const [copied, setCopied] = useState(false)

  const copyInstallUrl = () => {
    if (!app) return
    const url = getInstallUrl(app)
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-2xl border border-slate-200 p-6 shadow-xl"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {t('Uninstall Bedi Delivery first', 'أزل تطبيق بدي للتوصيل أولاً')}
          </DialogTitle>
          <DialogDescription className="mt-2 text-slate-600">
            {t(
              'Chrome allows only one PWA per scope. You have Bedi Delivery installed. To install Bedi Driver or Bedi Business, uninstall Bedi Delivery first, then open the link below in your browser.',
              'Chrome يسمح بتطبيق واحد فقط لكل نطاق. لديك تطبيق بدي للتوصيل مثبتاً. لتثبيت بدي للسائقين أو بدي للأعمال، أزل تطبيق بدي للتوصيل أولاً، ثم افتح الرابط أدناه في متصفحك.'
            )}
          </DialogDescription>
        </DialogHeader>
        <ol className="mt-6 space-y-3 text-sm text-slate-700">
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-700">
              1
            </span>
            <span>
              {t('Long-press the Bedi Delivery icon on your home screen.', 'اضغط مطولاً على أيقونة بدي للتوصيل على الشاشة الرئيسية.')}
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-700">
              2
            </span>
            <span>
              {t('Tap "Uninstall" or "Remove from Home screen".', 'اضغط "إلغاء التثبيت" أو "إزالة من الشاشة الرئيسية".')}
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-700">
              3
            </span>
            <span>
              {t('Open Chrome/Safari and go to the link below to install the new app.', 'افتح Chrome أو Safari واذهب إلى الرابط أدناه لتثبيت التطبيق الجديد.')}
            </span>
          </li>
        </ol>
        {app && (
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex items-center gap-2 break-all rounded-xl bg-slate-100 px-4 py-3 font-mono text-sm text-slate-800">
              {getInstallUrl(app)}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyInstallUrl} className="flex-1 gap-2">
                {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                {copied ? t('Copied!', 'تم النسخ!') : t('Copy link', 'نسخ الرابط')}
              </Button>
              <Button
                size="sm"
                onClick={() => window.open(getInstallUrl(app), '_blank')}
                className="flex-1 gap-2 bg-slate-900 text-white hover:bg-slate-800 hover:text-white"
              >
                <ExternalLink className="size-4" />
                {t('Open in browser', 'فتح في المتصفح')}
              </Button>
            </div>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="mt-4 w-full text-slate-500">
          {t('Close', 'إغلاق')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
