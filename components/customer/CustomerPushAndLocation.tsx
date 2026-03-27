'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'
import { getCustomerPushSubscriptionToken, syncCustomerTokenToServer } from '@/lib/customer-push-subscribe'
import { isFirebaseConfigured } from '@/lib/firebase-config'
import { getDeviceGeolocationPosition, isDeviceGeolocationSupported, checkDeviceGeolocationPermission } from '@/lib/device-geolocation'

const STORAGE_KEY_DISMISSED = 'bedi-customer-push-dismissed'
const AUTO_PROMPT_DELAY_MS = 2000

export function CustomerPushAndLocation() {
  const { t } = useLanguage()
  const [mounted, setMounted] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission | null>(null)
  const [locationState, setLocationState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt')
  const [pushLoading, setPushLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showManualInstructions, setShowManualInstructions] = useState(false)

  const syncPermissions = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (typeof Notification !== 'undefined') setPushPermission(Notification.permission)
    
    if (!isDeviceGeolocationSupported()) {
      setLocationState('unsupported')
      return
    }
    
    const status = await checkDeviceGeolocationPermission()
    setLocationState(status)
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])
  useEffect(() => {
    if (!mounted) return
    syncPermissions()
    try {
      setDismissed(sessionStorage.getItem(STORAGE_KEY_DISMISSED) === '1')
    } catch {
      // ignore
    }
  }, [mounted, syncPermissions])

  const requestPush = useCallback(async () => {
    if (typeof window === 'undefined') return false
    if (typeof isFirebaseConfigured !== 'function' || !isFirebaseConfigured()) return false
    
    const isNative = (window as any).Capacitor?.isNativePlatform()
    if (!isNative && typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setShowManualInstructions(true)
      return false
    }
    
    setPushLoading(true)
    try {
      const { token, permissionState } = await getCustomerPushSubscriptionToken(true)
      
      if (permissionState === 'granted' && typeof Notification !== 'undefined') {
        setPushPermission('granted')
      } else if (permissionState === 'denied') {
        setShowManualInstructions(true)
        return false
      }
      
      if (token) {
        await syncCustomerTokenToServer(token, { source: 'customer-push-and-location' })
      }
      return true
    } catch {
      return false
    } finally {
      setPushLoading(false)
    }
  }, [])

  const requestLocation = useCallback(async () => {
    if (!isDeviceGeolocationSupported()) return
    try {
      await getDeviceGeolocationPosition({ enableHighAccuracy: false, timeout: 5000, maximumAge: 0 })
      setLocationState('granted')
      syncPermissions()
    } catch {
      setLocationState('denied')
      setShowManualInstructions(true)
    }
  }, [syncPermissions])

  const dismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(STORAGE_KEY_DISMISSED, '1')
    } catch {
      // ignore
    }
  }

  if (!mounted || dismissed) return null
  const canUsePush = typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()
  const needsPush = canUsePush && pushPermission !== 'granted' && typeof Notification !== 'undefined'
  const needsLocation = locationState === 'prompt' && isDeviceGeolocationSupported()
  const showBanner = (needsPush || needsLocation) && (pushPermission !== 'denied' || locationState !== 'denied' || showManualInstructions)

  if (!showBanner) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 md:bottom-6 md:left-6 md:right-auto md:max-w-sm" role="region" aria-label={t('Notifications & location', 'الإشعارات والموقع')}>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex gap-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm">
                {t('Stay updated', 'ابقَ على اطلاع')}
              </h3>
              <p className="text-slate-600 text-xs mt-0.5">
                {t('Enable notifications for order updates and offers. Location helps show nearby businesses.', 'فعّل الإشعارات لتحديثات الطلبات والعروض. الموقع يساعد في عرض الأعمال القريبة.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={t('Dismiss', 'إغلاق')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {showManualInstructions && (pushPermission === 'denied' || locationState === 'denied') && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            <p className="font-medium mb-1">{t('To enable manually:', 'للتشغيل يدوياً:')}</p>
            <p>
              {t('Open your browser or device Settings → find this site (Bedi) → allow Notifications and Location.', 'افتح إعدادات المتصفح أو الجهاز → ابحث عن هذا الموقع (Bedi) → اسمح بالإشعارات والموقع.')}
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2">
          {needsPush && pushPermission !== 'denied' && (
            <Button
              size="sm"
              onClick={requestPush}
              disabled={pushLoading}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700"
            >
              <Bell className="w-4 h-4 mr-2" />
              {pushLoading ? t('Enabling…', 'جاري التفعيل…') : t('Enable notifications', 'تفعيل الإشعارات')}
            </Button>
          )}
          {needsLocation && (
            <Button
              size="sm"
              variant="outline"
              onClick={requestLocation}
              className="w-full rounded-xl"
            >
              <MapPin className="w-4 h-4 mr-2" />
              {t('Enable location', 'تفعيل الموقع')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
