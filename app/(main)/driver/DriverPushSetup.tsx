'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Bell, CheckCircle2, RefreshCw, Share } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useDriverPush } from './DriverPushContext'

/** Banner: prompts driver to enable push (required for receiving orders). When push is active, shows a compact refresh button. */
export function DriverPushSetup() {
  const { t } = useLanguage()
  const { hasPush, checked, loading, isDenied, needsIOSHomeScreen, subscribe, refreshToken } = useDriverPush()
  const [isRefreshing, setIsRefreshing] = useState(false)

  if (!checked) return null

  // Push is active — show compact status + refresh option
  if (hasPush) {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-600/40 bg-emerald-950/30 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {t('Notifications active', 'الإشعارات مفعّلة')}
        </span>
        <Button
          type="button"
          size="sm"
          disabled={isRefreshing}
          variant="ghost"
          className="h-8 px-3 text-xs text-emerald-300 hover:bg-emerald-900/40 hover:text-emerald-200"
          onClick={async () => {
            setIsRefreshing(true)
            await refreshToken()
            setIsRefreshing(false)
          }}
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 rtl:ml-1.5 rtl:mr-0 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? t('Refreshing…', 'جاري…') : t('Refresh', 'تحديث')}
        </Button>
      </div>
    )
  }

  const iosTitle = t('Enable notifications required', 'تفعيل الإشعارات مطلوب')
  const iosBody = t(
    'You cannot receive orders without enabling notifications. When a new order arrives you will get an alert even if the app is closed.',
    'لا يمكنك استقبال الطلبات دون تفعيل الإشعارات. عند وصول طلب جديد ستتلقى تنبيهاً حتى لو كان التطبيق مغلقاً.'
  )
  const iosSteps = t(
    'On iPhone: Add the app to Home Screen (Share → Add to Home Screen), then open it and tap Enable.',
    'على iPhone: أضف التطبيق إلى الشاشة الرئيسية (مشاركة ← إضافة إلى الشاشة الرئيسية) ثم افتحه واضغط تفعيل.'
  )
  const deniedText = t(
    'To receive new orders: enable notifications in browser settings, then refresh and tap Enable.',
    'للاستقبال طلبات جديدة: فعّل الإشعارات من إعدادات المتصفح ثم حدّث الصفحة واضغط تفعيل.'
  )
  const requiredText = t(
    'To receive new orders when the app is closed: enable notifications (required).',
    'للاستقبال طلبات جديدة عند إغلاق التطبيق: فعّل الإشعارات (إلزامي).'
  )
  const settingsText = t('Browser settings → Notifications → Allow Bedi Driver', 'إعدادات المتصفح ← الإشعارات ← اسمح لـ Bedi Driver')
  const addToHomeBtn = t('Add to Home Screen first', 'إضافة للشاشة الرئيسية أولاً')
  const enablingBtn = t('Enabling…', 'جاري...')
  const enableBtn = t('Enable', 'تفعيل')

  return (
    <div className="mb-4 rounded-xl border border-amber-600/60 bg-amber-950/40 p-4">
      {needsIOSHomeScreen ? (
        <>
          <p className="text-sm font-medium text-amber-200 mb-2">{iosTitle}</p>
          <p className="text-sm text-amber-200/90 mb-2">{iosBody}</p>
          <p className="text-sm text-amber-200/90 mb-3">{iosSteps}</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-amber-200 mb-2">
            {isDenied ? deniedText : requiredText}
          </p>
          {isDenied && (
            <p className="text-xs text-amber-300/80 mb-3">{settingsText}</p>
          )}
        </>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="default"
          disabled={loading || (isDenied && !needsIOSHomeScreen)}
          className="min-h-[44px] min-w-[44px] touch-manipulation bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          onClick={() => subscribe()}
        >
          {needsIOSHomeScreen ? (
            <>
              <Share className="ml-1.5 size-4 shrink-0" />
              {addToHomeBtn}
            </>
          ) : (
            <>
              <Bell className="ml-1.5 size-4 shrink-0" />
              {loading ? enablingBtn : enableBtn}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
