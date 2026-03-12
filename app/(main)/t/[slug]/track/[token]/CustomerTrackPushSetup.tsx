'use client'

import { Bell, BellOff, RefreshCw } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useCustomerTrackPush } from './useCustomerTrackPush'

type Props = { slug: string; token: string }

export function CustomerTrackPushSetup({ slug, token }: Props) {
  const { t } = useLanguage()
  const {
    hasPush,
    checked,
    loading,
    permission,
    needsIOSHomeScreen,
    doSubscribe,
    refreshToken,
    isRefreshing,
  } = useCustomerTrackPush(slug, token)

  const deniedInstructions = () => {
    if (needsIOSHomeScreen) {
      return t(
        'On iPhone/iPad: Settings → Safari → Notifications → Allow for this site, then reopen the order page and tap Enable.',
        'على iPhone/iPad: الإعدادات → Safari → الإشعارات → السماح لهذا الموقع، ثم أعد فتح صفحة الطلب واضغط تفعيل.'
      )
    }
    return t(
      'On Desktop: click the lock icon near the address bar → Notifications → Allow, then refresh and tap Enable.',
      'على سطح المكتب: اضغط أيقونة القفل بجانب شريط العنوان → الإشعارات → السماح، ثم حدّث الصفحة واضغط تفعيل.'
    )
  }

  if (!checked) return null

  if (hasPush) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-emerald-800">
          <Bell className="h-4 w-4 shrink-0" />
          {t('Notifications enabled', 'الإشعارات مفعّلة')}
        </span>
        <button
          type="button"
          onClick={refreshToken}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? t('Refreshing…', 'جاري التحديث…') : t('Refresh', 'تحديث')}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-5">
      <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
        <BellOff className="h-4 w-4 text-slate-500" />
        {t('Get a notification every time your order status changes', 'استلم إشعاراً عند كل تغيير في حالة الطلب')}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        {t('We will keep reminding you until notifications are enabled.', 'سنستمر بتذكيرك حتى يتم تفعيل الإشعارات.')}
      </p>
      {needsIOSHomeScreen && (
        <p className="mt-2 text-xs text-amber-700">
          {t(
            'On iPhone/iPad, push works after adding Bedi to Home Screen. Open from the app icon, then tap Enable.',
            'على iPhone/iPad تعمل الإشعارات بعد إضافة Bedi إلى الشاشة الرئيسية. افتحه من أيقونة التطبيق ثم اضغط تفعيل.'
          )}
        </p>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          if (needsIOSHomeScreen) {
            if (typeof window !== 'undefined' && typeof window.alert === 'function') {
              window.alert(
                t(
                  'Add this page to Home Screen first, open it from the app icon, then tap Enable again.',
                  'أضف هذه الصفحة إلى الشاشة الرئيسية أولاً، وافتحها من أيقونة التطبيق، ثم اضغط تفعيل مرة أخرى.'
                )
              )
            }
            return
          }
          if (permission === 'denied') {
            if (typeof window !== 'undefined') {
              if (typeof window.alert === 'function') window.alert(deniedInstructions())
            }
            return
          }
          doSubscribe()
        }}
        disabled={loading}
        className="mt-3 flex min-h-[48px] w-full touch-manipulation cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 active:scale-[0.98]"
      >
        {loading
          ? t('Enabling…', 'جاري التفعيل…')
          : needsIOSHomeScreen
            ? t('Open from Home Screen first', 'افتح من الشاشة الرئيسية أولاً')
            : t('Enable status notifications', 'تفعيل إشعارات الحالة')}
      </button>
      {permission === 'denied' && (
        <p className="mt-2 text-xs text-amber-700">
          {deniedInstructions()}
        </p>
      )}
    </div>
  )
}
