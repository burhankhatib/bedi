'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Bell, AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useTenantPush } from './TenantPushContext'

function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

/**
 * Non-blocking banner on the Business Orders page when push is not yet enabled.
 * Never blocks interaction; orders list remains accessible. FCM delivery unchanged:
 * when tenant enables, token is stored via /api/tenants/[slug]/push-subscription.
 */
export function TenantOrdersGate({ slug, children }: { slug: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const { hasPush, checked, loading, isDenied, subscribe } = useTenantPush()
  const [bypassDenied, setBypassDenied] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const ordersPath = `/t/${slug}/orders`
  const isOnOrdersPage = pathname === ordersPath

  if (!isOnOrdersPage || hasPush || !checked) return <>{children}</>
  if (bypassDenied && isDenied) return <>{children}</>
  if (dismissed && !isDenied) return <>{children}</>

  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

  const banner = (
    <div className="sticky top-0 z-50 rounded-xl border-2 border-amber-500/60 bg-amber-950/50 p-4 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isDenied ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="size-5 shrink-0 text-amber-400" />
                <h3 className="font-bold text-amber-200 text-sm">
                  {t('Notifications are blocked', 'الإشعارات محجوبة')}
                </h3>
              </div>
              {expanded && (
                <p className="text-amber-200/90 text-xs mb-3">
                  {t(
                    'To receive new order alerts, allow notifications in browser settings.',
                    'لاستقبال تنبيهات الطلبات، سماح بالإشعارات من إعدادات المتصفح.'
                  )}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Bell className="size-5 shrink-0 text-amber-400" />
                <h3 className="font-bold text-amber-200 text-sm">
                  {t('Enable notifications', 'تفعيل الإشعارات')}
                </h3>
              </div>
              {expanded && (
                <p className="text-amber-200/90 text-xs mb-3">
                  {t(
                    'Get instant alerts for new orders even when this page is closed.',
                    'تنبيهات فورية للطلبات الجديدة حتى عند إغلاق الصفحة.'
                  )}
                </p>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {!isDenied && (
              <Button
                type="button"
                size="sm"
                disabled={loading}
                className="min-h-[40px] touch-manipulation bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                onClick={() => subscribe()}
              >
                <Bell className="mr-1.5 size-4 shrink-0" />
                {loading ? t('Enabling…', 'جاري...') : t('Enable', 'تفعيل')}
              </Button>
            )}
            {isDenied && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-[40px] border-slate-600 text-slate-300 hover:bg-slate-800"
                onClick={() => setBypassDenied(true)}
              >
                {t('Continue without notifications', 'متابعة بدون إشعارات')}
              </Button>
            )}
            {!isDenied && expanded && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-[40px] text-slate-400 hover:text-slate-200"
                onClick={() => setDismissed(true)}
              >
                {t('Dismiss for now', 'تجاهل الآن')}
              </Button>
            )}
          </div>
          {isAndroid && expanded && !isDenied && (
            <p className="text-xs text-amber-200/70 mt-2">
              {t('Tap Enable then choose Allow in the dialog.', 'اضغط تفعيل ثم اختر السماح.')}
            </p>
          )}
          {isIOS() && expanded && !isDenied && (
            <p className="text-xs text-amber-200/70 mt-2">
              {t('iPhone: Add to Home Screen first, then tap Enable.', 'iPhone: أضف للشاشة الرئيسية أولاً ثم اضغط تفعيل.')}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 text-amber-200/70 hover:text-amber-200"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? t('Collapse', 'طي') : t('Expand', 'توسيع')}
          >
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
          {!isDenied && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 text-amber-200/70 hover:text-amber-200"
              onClick={() => setDismissed(true)}
              aria-label={t('Dismiss', 'إغلاق')}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {banner}
      {children}
    </>
  )
}
