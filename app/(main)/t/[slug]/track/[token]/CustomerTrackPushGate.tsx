'use client'

import { useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useCustomerTrackPush } from './useCustomerTrackPush'

const BYPASS_KEY = 'customer-track-push-bypass'

function getBypass(slug: string, token: string): boolean {
  if (typeof sessionStorage === 'undefined') return false
  try {
    const raw = sessionStorage.getItem(BYPASS_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { slug?: string; token?: string } | null
    return parsed?.slug === slug && parsed?.token === token
  } catch {
    return false
  }
}

function setBypass(slug: string, token: string, value: boolean) {
  if (typeof sessionStorage === 'undefined') return
  try {
    if (value) {
      sessionStorage.setItem(BYPASS_KEY, JSON.stringify({ slug, token }))
    } else {
      sessionStorage.removeItem(BYPASS_KEY)
    }
  } catch {
    // ignore
  }
}

type Props = { slug: string; token: string; children: React.ReactNode }

/**
 * Gates the order tracking content until FCM/push is enabled.
 * When permission is denied, shows "Continue without notifications" so the user can still view their order.
 */
export function CustomerTrackPushGate({ slug, token, children }: Props) {
  const { t } = useLanguage()
  const [userBypass, setUserBypass] = useState(() => getBypass(slug, token))
  const {
    hasPush,
    checked,
    loading,
    permission,
    needsIOSHomeScreen,
    doSubscribe,
    subscribe,
  } = useCustomerTrackPush(slug, token)

  const showGate = !userBypass && checked && !hasPush
  const handleBypass = () => {
    setBypass(slug, token, true)
    setUserBypass(true)
  }

  const handleEnable = () => {
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
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        const msg = t(
          'On iPhone/iPad: Settings → Safari → Notifications → Allow for this site, then reopen and tap Enable.',
          'على iPhone/iPad: الإعدادات → Safari → الإشعارات → السماح لهذا الموقع، ثم أعد فتح الصفحة واضغط تفعيل.'
        ) + '\n\n' + t(
          'On Android: Browser site settings → Notifications → Allow, then return and tap Enable.',
          'على Android: إعدادات الموقع → الإشعارات → السماح، ثم ارجع واضغط تفعيل.'
        ) + '\n\n' + t(
          'On Desktop: click the lock icon → Notifications → Allow, then refresh and tap Enable.',
          'على سطح المكتب: اضغط أيقونة القفل → الإشعارات → السماح، ثم حدّث واضغط تفعيل.'
        )
        window.alert(msg)
      }
      return
    }
    subscribe()
  }

  if (!checked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="text-center px-6">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-500" />
          <p className="mt-4 text-slate-500">{t('Checking notifications…', 'جاري التحقق من الإشعارات…')}</p>
        </div>
      </div>
    )
  }

  if (!showGate) {
    return <>{children}</>
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-white px-6">
      <div className="w-full max-w-md rounded-3xl border-2 border-emerald-200 bg-white p-8 shadow-xl">
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Bell className="h-8 w-8 text-amber-600" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-slate-800 text-center">
          {t('Enable notifications to track your order', 'فعّل الإشعارات لمتابعة طلبك')}
        </h1>
        <p className="mt-3 text-sm text-slate-600 text-center">
          {t(
            'Get notified when your order is ready and when the driver arrives. You won’t miss important updates.',
            'استلم إشعاراً عند جاهزية الطلب وعند وصول السائق. لن تفوت أي تحديث مهم.'
          )}
        </p>
        <p className="mt-2 text-sm font-semibold text-amber-700 text-center flex items-center justify-center gap-2">
          <BellOff className="h-4 w-4" />
          {t('Especially when the driver arrives — so you can collect your order!', 'وخاصة عند وصول السائق — لتكون جاهزاً لاستلام طلبك!')}
        </p>
        {needsIOSHomeScreen && (
          <p className="mt-3 text-xs text-amber-700 text-center">
            {t(
              'On iPhone/iPad, add this page to Home Screen first, open from the app icon, then tap Enable.',
              'على iPhone/iPad أضف هذه الصفحة إلى الشاشة الرئيسية أولاً، وافتحها من أيقونة التطبيق، ثم اضغط تفعيل.'
            )}
          </p>
        )}
        <button
          type="button"
          onClick={handleEnable}
          disabled={loading}
          className="mt-6 flex min-h-[52px] w-full touch-manipulation cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-base font-bold text-white shadow-lg transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 active:scale-[0.98]"
        >
          {loading
            ? t('Enabling…', 'جاري التفعيل…')
            : needsIOSHomeScreen
              ? t('Open from Home Screen first', 'افتح من الشاشة الرئيسية أولاً')
              : t('Enable notifications', 'تفعيل الإشعارات')}
        </button>
        {permission === 'denied' && (
          <p className="mt-3 text-xs text-amber-700 text-center">
            {t(
              'Notifications were blocked. Enable them in your browser or device settings, then refresh this page.',
              'تم حظر الإشعارات. فعّلها من إعدادات المتصفح أو الجهاز، ثم حدّث هذه الصفحة.'
            )}
          </p>
        )}
        <button
          type="button"
          onClick={handleBypass}
          className="mt-4 w-full py-2 text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
        >
          {t('Continue without notifications', 'متابعة بدون إشعارات')}
        </button>
      </div>
    </div>
  )
}
