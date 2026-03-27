'use client'

import { useState, useCallback } from 'react'
import { MapPin, RefreshCw } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useToast } from '@/components/ui/ToastProvider'
import { getDevicePushToken } from '@/lib/push-token'
import { isFirebaseConfigured } from '@/lib/firebase-config'
import { getDeviceGeolocationPosition, isDeviceGeolocationSupported, isGeolocationUserDenied } from '@/lib/device-geolocation'

export function CustomerSidebarActions() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [pushLoading, setPushLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)

  const requestPush = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
      showToast('Notifications not supported in this browser.', 'الإشعارات غير مدعومة في هذا المتصفح.', 'error')
      return false
    }
    if (typeof isFirebaseConfigured !== 'function' || !isFirebaseConfigured()) {
      showToast('Push not configured.', 'الإشعارات غير مهيأة.', 'error')
      return false
    }
    if (Notification.permission === 'denied') {
      showToast(
        'Notifications are blocked. Please enable them in your browser settings.',
        'الإشعارات محجوبة. يرجى تفعيلها من إعدادات المتصفح.',
        'error'
      )
      return false
    }
    
    setPushLoading(true)
    try {
      let registration = await navigator.serviceWorker.getRegistration('/')
      if (!registration) {
        await navigator.serviceWorker.register('/customer-sw.js', { scope: '/' })
        registration = await navigator.serviceWorker.ready
      }
      if (!registration) throw new Error('No service worker')
      
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        showToast('Notification permission denied.', 'تم رفض صلاحية الإشعارات.', 'error')
        return false
      }
      
      const { token } = await getDevicePushToken(registration)
      if (token) {
        await fetch('/api/customer/push-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fcmToken: token }),
        })
        showToast(
          'تم تحديث الإشعارات بنجاح.',
          'Notifications refreshed successfully.',
          'success'
        )
        return true
      }
      throw new Error('No token')
    } catch {
      showToast(
        'تعذّر تحديث الإشعارات. تأكد من السماح بالإشعارات.',
        'Could not refresh notifications. Make sure they are allowed.',
        'error'
      )
      return false
    } finally {
      setPushLoading(false)
    }
  }, [showToast])

  const requestLocation = useCallback(async () => {
    if (!isDeviceGeolocationSupported()) {
      showToast('Location not supported in this browser.', 'الموقع غير مدعوم في هذا المتصفح.', 'error')
      return
    }
    setLocationLoading(true)
    try {
      await getDeviceGeolocationPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 0 })
      setLocationLoading(false)
      showToast('تم تفعيل الموقع بنجاح.', 'Location enabled successfully.', 'success')
    } catch (err) {
      setLocationLoading(false)
      if (isGeolocationUserDenied(err)) {
        showToast(
          'تم رفض الوصول للموقع. فعّله من إعدادات المتصفح.',
          'Location access denied. Enable it in your browser settings.',
          'error'
        )
      } else {
        showToast('تعذّر الحصول على الموقع.', 'Could not get location.', 'error')
      }
    }
  }, [showToast])

  return (
    <div className="mt-4 border-t border-slate-100 px-6 pt-4 pb-2 space-y-2 dark:border-slate-800">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        {t('Device & Location', 'الجهاز والموقع')}
      </p>
      
      <button
        type="button"
        onClick={requestLocation}
        disabled={locationLoading}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white dark:active:bg-slate-800"
      >
        <MapPin className={`size-5 shrink-0 ${locationLoading ? 'animate-pulse text-blue-500' : 'text-slate-400'}`} />
        {locationLoading
          ? t('Getting location…', 'جاري تحديد الموقع…')
          : t('Share Location', 'مشاركة الموقع')}
      </button>

      <button
        type="button"
        onClick={requestPush}
        disabled={pushLoading}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white dark:active:bg-slate-800"
      >
        <RefreshCw className={`size-5 shrink-0 text-slate-400 ${pushLoading ? 'animate-spin' : ''}`} />
        {pushLoading ? t('Refreshing…', 'جاري التحديث…') : t('Refresh Notifications', 'تحديث الإشعارات')}
      </button>
    </div>
  )
}
