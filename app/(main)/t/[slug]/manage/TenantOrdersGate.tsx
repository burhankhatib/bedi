'use client'

import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Bell } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useTenantPush } from './TenantPushContext'

function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

/**
 * When on the Business Orders page and push is not enabled, shows a full-screen gate.
 * Only prompts when notifications are not enabled. If already enabled, gate is never shown.
 * Does not bypass: tenant must enable notifications to view orders; no access until enabled.
 */
export function TenantOrdersGate({ slug, children }: { slug: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const { hasPush, checked, loading, isDenied, subscribe } = useTenantPush()

  const ordersPath = `/t/${slug}/orders`
  const isOnOrdersPage = pathname === ordersPath
  const showGate = isOnOrdersPage && checked && !hasPush

  if (!isOnOrdersPage || hasPush) return <>{children}</>
  if (!checked) return <>{children}</>

  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

  return (
    <div className="fixed inset-0 z-[100] flex min-h-full min-h-[100dvh] flex-col items-center justify-center gap-6 bg-slate-950 px-4 py-8 text-center">
      <div className="rounded-2xl border-2 border-amber-500/60 bg-amber-950/50 p-6 max-w-md">
        <h2 className="text-xl font-bold text-amber-200 mb-2">
          {t('Enable notifications required', 'تفعيل الإشعارات مطلوب')}
        </h2>
        <p className="text-amber-200/90 text-sm mb-4">
          {t('You need to enable notifications to view orders and get alerts when a new order arrives, even if the app or browser is closed.', 'يجب تفعيل الإشعارات لعرض الطلبات واستقبال تنبيه عند وصول طلب جديد، حتى لو كان التطبيق أو المتصفح مغلقاً.')}
        </p>
        {isAndroid && (
          <p className="text-xs text-amber-200/80 mb-4">
            {t('Tap "Enable notifications" below then choose "Allow" in the dialog.', 'اضغط «تفعيل الإشعارات» أدناه ثم اختر «السماح» في النافذة.')}
          </p>
        )}
        {isIOS() && !isDenied && (
          <p className="text-xs text-amber-200/80 mb-4">
            {t('On iPhone: Add the app to Home Screen then open it and tap Enable.', 'على iPhone: أضف التطبيق إلى الشاشة الرئيسية ثم افتحه واضغط تفعيل.')}
          </p>
        )}
        <Button
          type="button"
          size="lg"
          disabled={loading || isDenied}
          className="min-h-[52px] w-full touch-manipulation bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base"
          onClick={() => subscribe()}
        >
          <Bell className="ml-2 size-5 shrink-0" />
          {loading ? t('Enabling…', 'جاري التفعيل...') : t('Enable notifications', 'تفعيل الإشعارات')}
        </Button>
        {isDenied && (
          <p className="mt-3 text-xs text-amber-300/80">
            {t('Browser settings → Notifications → Allow this site, then reopen the page.', 'إعدادات المتصفح ← الإشعارات ← اسمح لهذا الموقع ثم أعد فتح الصفحة.')}
          </p>
        )}
      </div>
    </div>
  )
}
