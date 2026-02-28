'use client'

import { useState } from 'react'
import { MapPin, RefreshCw } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useToast } from '@/components/ui/ToastProvider'
import { useDriverPush } from './DriverPushContext'

export function DriverSidebarActions() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const { requestLocation, locationLoading, refreshToken } = useDriverPush()
  const [isRefreshing, setIsRefreshing] = useState(false)

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

  return (
    <div className="mt-4 border-t border-slate-800 px-6 pt-4 pb-2 space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        {t('Device & Location', 'الجهاز والموقع')}
      </p>
      
      <button
        type="button"
        onClick={() => requestLocation()}
        disabled={locationLoading}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white active:bg-slate-800 disabled:opacity-50"
      >
        <MapPin className={`size-5 shrink-0 ${locationLoading ? 'animate-pulse text-blue-400' : 'text-slate-400'}`} />
        {locationLoading
          ? t('Getting location…', 'جاري تحديد الموقع…')
          : t('Update My Location', 'تحديث موقعي')}
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
