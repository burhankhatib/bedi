'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Bell, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useDriverPush } from './DriverPushContext'

const GATE_SKIP_KEY = 'bedi-driver-push-gate-skipped'

function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(navigator as unknown as { userAgentData?: { platform: string } }).userAgentData?.platform
}

/**
 * When on driver pages (except Profile / history / analytics) and push is not enabled,
 * shows a full-screen gate with "Enable notifications" and "Continue to Orders".
 * "Continue to Orders" lets the driver reach the orders tab (e.g. on iOS to add to Home
 * Screen from there and get the correct Driver PWA). Push banner remains on the orders page.
 */
export function DriverOrdersGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const { hasPush, checked, loading, isDenied, needsIOSHomeScreen, subscribe } = useDriverPush()
  const [skipped, setSkipped] = useState(false)
  const [isStandalone, setIsStandalone] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const timer = setTimeout(() => {
      try {
        setSkipped(sessionStorage.getItem(GATE_SKIP_KEY) === '1')
        const standalone = window.matchMedia('(display-mode: standalone)').matches
          || (window.navigator as unknown as { standalone?: boolean }).standalone === true
        setIsStandalone(standalone)
      } catch {
        setSkipped(false)
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (hasPush) {
      const timer = setTimeout(() => {
        try {
          sessionStorage.removeItem(GATE_SKIP_KEY)
        } catch {
          // ignore
        }
        setSkipped(false)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [hasPush])

  const isDriverPage = pathname?.startsWith('/driver') === true
  const isProfilePage = pathname === '/driver/profile'
  const isReadOnlyPage = pathname === '/driver/history' || pathname === '/driver/analytics'

  const handleContinueToOrders = () => {
    try {
      sessionStorage.setItem(GATE_SKIP_KEY, '1')
    } catch {
      // ignore
    }
    setSkipped(true)
  }

  if (!isDriverPage || isProfilePage || isReadOnlyPage || hasPush || skipped || !isStandalone) return <>{children}</>
  if (!checked) return <>{children}</>

  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

  return (
    <div className="fixed inset-0 z-[100] flex min-h-full min-h-[100dvh] flex-col items-center justify-center gap-6 bg-slate-950 px-4 py-8 text-center">
      <div className="rounded-2xl border-2 border-amber-500/60 bg-amber-950/50 p-6 max-w-md">
        <h2 className="text-xl font-bold text-amber-200 mb-2">
          {t('Enable notifications required', 'تفعيل الإشعارات مطلوب')}
        </h2>
        <p className="text-amber-200/90 text-sm mb-4">
          {t('You cannot receive orders without enabling notifications. When a new order arrives you will get an alert even if the app is closed.', 'لا يمكنك استقبال الطلبات دون تفعيل الإشعارات. عند وصول طلب جديد ستتلقى تنبيهاً حتى لو كان التطبيق مغلقاً.')}
        </p>
        {isAndroid && (
          <p className="text-xs text-amber-200/80 mb-4">
            {t('Tap "Enable notifications" below then choose "Allow" in the dialog. Notifications will then be enabled in app settings.', 'اضغط «تفعيل الإشعارات» أدناه ثم اختر «السماح» في النافذة. بعدها ستُفعّل الإشعارات في إعدادات التطبيق تلقائياً.')}
          </p>
        )}
        {isIOS() && !isDenied && (
          <p className="text-xs text-amber-200/80 mb-4">
            {t('On iPhone: tap "Continue to Orders" below, then add the app to Home Screen from the Orders page. Open the app from the home screen and tap Enable.', 'على iPhone: اضغط «متابعة إلى الطلبات» أدناه، ثم أضف التطبيق إلى الشاشة الرئيسية من صفحة الطلبات. افتح التطبيق من الشاشة الرئيسية واضغط تفعيل.')}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            size="lg"
            disabled={loading || (isDenied && !needsIOSHomeScreen)}
            className="min-h-[52px] w-full touch-manipulation bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base"
            onClick={() => subscribe()}
          >
            <Bell className="ml-2 size-5 shrink-0" />
            {loading ? t('Enabling…', 'جاري التفعيل...') : t('Enable notifications', 'تفعيل الإشعارات')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-[48px] w-full touch-manipulation border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700 font-medium"
            onClick={handleContinueToOrders}
          >
            <ArrowRight className="ml-2 size-5 shrink-0" />
            {t('Continue to Orders', 'متابعة إلى الطلبات')}
          </Button>
        </div>
        {isDenied && !needsIOSHomeScreen && (
          <p className="mt-3 text-xs text-amber-300/80">
            {t('App settings → Notifications → Allow Bedi Driver, then reopen the app.', 'إعدادات التطبيق ← الإشعارات ← اسمح لـ Bedi Driver ثم أعد فتح التطبيق.')}
          </p>
        )}
      </div>
    </div>
  )
}
