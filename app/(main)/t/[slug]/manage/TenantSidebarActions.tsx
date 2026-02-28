'use client'

import { useState } from 'react'
import { MapPin, RefreshCw } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useToast } from '@/components/ui/ToastProvider'
import { useTenantPush } from './TenantPushContext'

export function TenantSidebarActions({ slug }: { slug: string }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const { refreshToken } = useTenantPush()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const ok = await refreshToken()
      if (ok) {
        showToast(
          'تم تحديث الإشعارات. جهازك متصل الآن.',
          'Notifications refreshed. Your device is connected.',
          'success'
        )
      } else {
        showToast(
          'تعذّر تحديث الإشعارات. تأكد من السماح بالإشعارات في إعدادات الجهاز.',
          'Could not refresh. Check notification permissions in device settings.',
          'error'
        )
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  const shareLocation = async () => {
    if (!navigator.geolocation) {
      showToast('Location is not supported in this browser.', 'الموقع غير مدعوم في هذا المتصفح.', 'error')
      return
    }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        try {
          const res = await fetch(`/api/tenants/${encodeURIComponent(slug)}/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng }),
          })
          if (!res.ok) throw new Error('Failed to save location')
          showToast('تم حفظ موقع العمل بنجاح!', 'Business location saved successfully!', 'success')
        } catch {
          showToast('فشل حفظ الموقع. حاول مرة أخرى.', 'Failed to save location. Try again.', 'error')
        } finally {
          setLocationLoading(false)
        }
      },
      (err) => {
        setLocationLoading(false)
        if (err.code === 1) {
          showToast(
            'تم رفض الوصول للموقع. فعّله من إعدادات المتصفح أو الجهاز.',
            'Location access denied. Enable it in your browser or device settings.',
            'error'
          )
        } else {
          showToast('تعذّر الحصول على الموقع. حاول مرة أخرى.', 'Could not get location. Try again.', 'error')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  return (
    <div className="mt-2 border-t border-slate-800 px-3 pt-4 pb-2 space-y-2">
      <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        {t('Device & Location', 'الجهاز والموقع')}
      </p>
      
      <button
        type="button"
        onClick={shareLocation}
        disabled={locationLoading}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white active:bg-slate-800 disabled:opacity-50"
      >
        <MapPin className={`size-5 shrink-0 ${locationLoading ? 'animate-pulse text-blue-400' : 'text-slate-400'}`} />
        {locationLoading
          ? t('Getting location…', 'جاري تحديد الموقع…')
          : t('Update Business GPS', 'تحديث موقع العمل')}
      </button>

      <button
        type="button"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white active:bg-slate-800 disabled:opacity-50"
      >
        <RefreshCw className={`size-5 shrink-0 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? t('Refreshing…', 'جاري التحديث…') : t('Refresh Notifications', 'تحديث الإشعارات')}
      </button>
    </div>
  )
}
