'use client'

import { Button } from '@/components/ui/button'
import { Bell, Share } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useDriverPush } from './DriverPushContext'

/** Banner: prompts driver to enable push (required for receiving orders). Always shown when push is not enabled. */
export function DriverPushSetup() {
  const { t } = useLanguage()
  const { hasPush, checked, loading, isDenied, needsIOSHomeScreen, subscribe } = useDriverPush()

  if (!checked || hasPush) return null

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
