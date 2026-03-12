'use client'

/**
 * PWA App Store-like banners for Driver and Tenant.
 * Smart linking: if user has Bedi Delivery (standalone) installed, show uninstall
 * guidance before installing Driver/Business PWA (Chrome scope limitation).
 */

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'motion/react'
import { Truck, Store, Download, ExternalLink, Copy, Check } from 'lucide-react'
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

type AppType = 'driver' | 'business'

const DRIVER_COLOR = '#9c2d2a'
const BUSINESS_COLOR = '#221f20'

const APPS = {
  driver: {
    name: 'Bedi Driver',
    href: '/driver',
    icon: Truck,
    color: DRIVER_COLOR,
    ctaLabel: { en: 'Get Bedi Driver', ar: 'احصل على بدي للسائقين' },
  },
  business: {
    name: 'Bedi Business',
    href: '/dashboard',
    icon: Store,
    color: BUSINESS_COLOR,
    ctaLabel: { en: 'Get Bedi Business', ar: 'احصل على بدي للأعمال' },
  },
} as const

function getUninstallUrl(app: AppType): string {
  if (typeof window === 'undefined') return ''
  const path = app === 'driver' ? '/driver' : '/dashboard'
  return `${window.location.origin}${path}`
}

export function PWAAppBanners() {
  const { t, lang } = useLanguage()
  const [uninstallModal, setUninstallModal] = useState<AppType | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCtaClick = (e: React.MouseEvent, app: AppType) => {
    if (isStandaloneMode()) {
      e.preventDefault()
      setUninstallModal(app)
    }
  }

  const copyInstallUrl = (app: AppType) => {
    const url = getUninstallUrl(app)
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <>
      <section
        className="mx-auto max-w-5xl px-4 py-6 md:py-8"
        aria-label={t('Download Driver and Business apps', 'تحميل تطبيقات السائق والأعمال')}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(APPS) as AppType[]).map((app) => {
            const config = APPS[app]
            const Icon = config.icon
            const ctaLabel = lang === 'ar' ? config.ctaLabel.ar : config.ctaLabel.en
            const color = config.color
            return (
              <motion.div
                key={app}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.35 }}
              >
                <Link
                  href={config.href}
                  onClick={(e) => handleCtaClick(e, app)}
                  className="group flex items-center gap-4 rounded-2xl border p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
                  style={{
                    borderColor: `${color}40`,
                    background: `linear-gradient(to bottom right, ${color}15, white)`,
                    boxShadow: `0 10px 40px -10px ${color}20`,
                  }}
                >
                  <div
                    className="flex size-14 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:scale-105"
                    style={{ backgroundColor: `${color}25`, color }}
                  >
                    <Icon className="size-7" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 text-lg">{config.name}</h3>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {app === 'driver'
                        ? t('Install for drivers — orders & notifications', 'تثبيت للسائقين — طلبات وإشعارات')
                        : t('Install for businesses — menus & orders', 'تثبيت للأعمال — قوائم وطلبات')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Download className="size-5 text-slate-400 group-hover:text-slate-600" />
                    <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">
                      {ctaLabel}
                    </span>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </section>

      <Dialog open={!!uninstallModal} onOpenChange={(o) => !o && setUninstallModal(null)}>
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
          {uninstallModal && (
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 font-mono text-sm text-slate-800 break-all">
                {getUninstallUrl(uninstallModal)}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyInstallUrl(uninstallModal)}
                  className="flex-1 gap-2"
                >
                  {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                  {copied ? t('Copied!', 'تم النسخ!') : t('Copy link', 'نسخ الرابط')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => window.open(getUninstallUrl(uninstallModal), '_blank')}
                  className="flex-1 gap-2"
                >
                  <ExternalLink className="size-4" />
                  {t('Open in browser', 'فتح في المتصفح')}
                </Button>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUninstallModal(null)}
            className="mt-4 w-full text-slate-500"
          >
            {t('Close', 'إغلاق')}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
