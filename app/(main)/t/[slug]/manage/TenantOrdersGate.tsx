'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Bell, AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useTenantPush } from './TenantPushContext'

function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

/**
 * Shown on the Business Orders page when push is not yet enabled.
 * - permission = default/granted-but-no-token → full-screen gate (user must enable)
 * - permission = denied → full-screen gate + "Continue without notifications" bypass
 *   (tenant cannot fix this from within the app; must go to browser settings)
 */
export function TenantOrdersGate({ slug, children }: { slug: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const { hasPush, checked, loading, isDenied, subscribe } = useTenantPush()
  const [bypassDenied, setBypassDenied] = useState(false)

  const ordersPath = `/t/${slug}/orders`
  const isOnOrdersPage = pathname === ordersPath

  // Pass-through: already has push, not on orders page, or not yet checked
  if (!isOnOrdersPage || hasPush || !checked) return <>{children}</>
  // User chose to bypass the denied-gate (they know they won't get notifications)
  if (bypassDenied && isDenied) return <>{children}</>

  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

  return (
    <div className="fixed inset-0 z-[100] flex min-h-full min-h-[100dvh] flex-col items-center justify-center bg-slate-950 px-4 py-8 text-center">
      <div className="rounded-2xl border-2 border-amber-500/60 bg-amber-950/50 p-6 max-w-md w-full">

        {isDenied ? (
          /* ── Denied state ── */
          <>
            <div className="flex items-center justify-center mb-3">
              <AlertTriangle className="size-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-amber-200 mb-2">
              {t('Notifications are blocked', 'الإشعارات محجوبة')}
            </h2>
            <p className="text-amber-200/90 text-sm mb-4">
              {t(
                'You blocked notifications for this site. To receive new order alerts, you must allow notifications in your browser settings.',
                'لقد حجبت الإشعارات لهذا الموقع. لاستقبال تنبيهات الطلبات الجديدة، يجب السماح بالإشعارات من إعدادات المتصفح.'
              )}
            </p>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3 text-xs text-slate-300 text-left mb-4 space-y-1">
              <p className="font-medium text-slate-200">
                {t('How to enable:', 'كيفية التفعيل:')}
              </p>
              {isAndroid ? (
                <p>{t('Chrome → Address bar lock icon → Notifications → Allow', 'Chrome ← أيقونة القفل ← الإشعارات ← سماح')}</p>
              ) : isIOS() ? (
                <p>{t('iOS Settings → Safari → Notifications → Allow for this site', 'إعدادات iOS ← Safari ← الإشعارات ← سماح لهذا الموقع')}</p>
              ) : (
                <p>{t('Browser Settings → Privacy & Security → Notifications → Allow this site', 'إعدادات المتصفح ← الخصوصية والأمان ← الإشعارات ← سماح')}</p>
              )}
            </div>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="w-full min-h-[52px] border-slate-600 text-slate-300 hover:bg-slate-800 text-sm mb-2"
              onClick={() => setBypassDenied(true)}
            >
              {t('Continue without notifications', 'متابعة بدون إشعارات')}
            </Button>
            <p className="text-xs text-amber-400/70 mt-1">
              {t('You will not receive alerts for new orders.', 'لن تستقبل تنبيهات للطلبات الجديدة.')}
            </p>
          </>
        ) : (
          /* ── Default / not-yet-subscribed state ── */
          <>
            <div className="flex items-center justify-center mb-3">
              <Bell className="size-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-amber-200 mb-2">
              {t('Enable notifications required', 'تفعيل الإشعارات مطلوب')}
            </h2>
            <p className="text-amber-200/90 text-sm mb-4">
              {t(
                'Enable notifications to receive instant alerts for new orders even when this page is closed.',
                'فعّل الإشعارات لاستقبال تنبيهات فورية للطلبات الجديدة حتى عند إغلاق الصفحة.'
              )}
            </p>
            {isAndroid && (
              <p className="text-xs text-amber-200/80 mb-4">
                {t('Tap "Enable" below then choose "Allow" in the dialog.', 'اضغط «تفعيل» أدناه ثم اختر «السماح» في النافذة.')}
              </p>
            )}
            {isIOS() && (
              <p className="text-xs text-amber-200/80 mb-4">
                {t('On iPhone: Add the app to Home Screen then open it and tap Enable.', 'على iPhone: أضف التطبيق إلى الشاشة الرئيسية ثم افتحه واضغط تفعيل.')}
              </p>
            )}
            <Button
              type="button"
              size="lg"
              disabled={loading}
              className="min-h-[52px] w-full touch-manipulation bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base"
              onClick={() => subscribe()}
            >
              <Bell className="ml-2 size-5 shrink-0" />
              {loading
                ? t('Enabling…', 'جاري التفعيل...')
                : t('Enable notifications', 'تفعيل الإشعارات')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
