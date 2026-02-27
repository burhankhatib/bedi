'use client'

import { useDriverStatus } from './DriverStatusContext'
import { useLanguage } from '@/components/LanguageContext'

export function DriverDashboardNav() {
  const { t } = useLanguage()
  const {
    isOnline,
    loading,
    updating,
    duration,
    canGoOffline,
    showCannotOffline,
    cannotGoOnline,
    toggle,
  } = useDriverStatus()

  const handleToggle = () => {
    if (updating) return
    if (isOnline && !canGoOffline) return
    if (!isOnline && cannotGoOnline) return
    toggle()
  }

  if (loading) return <span className="text-slate-500 text-sm">{t('Loading…', 'جاري التحميل…')}</span>
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap sm:gap-3">
      {duration && (
        <span className="text-sm font-medium text-slate-400 whitespace-nowrap hidden sm:inline">
          {t('Online for', 'متصل منذ')} {duration}
        </span>
      )}
      {showCannotOffline && (
        <span className="text-xs font-medium text-amber-400" title={t('Complete or cancel your deliveries first.', 'أكمل أو ألغِ توصيلاتك أولاً.')}>
          {t('Complete or cancel your deliveries first.', 'أكمل أو ألغِ توصيلاتك أولاً.')}
        </span>
      )}
      {cannotGoOnline && !isOnline && (
        <span className="text-xs font-medium text-amber-400" title={t('Enable notifications from the Orders page first.', 'فعّل الإشعارات من صفحة الطلبات أولاً.')}>
          {t('Enable notifications from the Orders page first.', 'فعّل الإشعارات من صفحة الطلبات أولاً.')}
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleToggle()
        }}
        onPointerDown={(e) => e.currentTarget.releasePointerCapture?.(e.pointerId)}
        disabled={updating || (isOnline && !canGoOffline) || (!isOnline && cannotGoOnline)}
        title={showCannotOffline ? t('Complete or cancel your deliveries first.', 'أكمل أو ألغِ توصيلاتك أولاً.') : cannotGoOnline && !isOnline ? t('Enable notifications from the Orders page first.', 'فعّل الإشعارات من صفحة الطلبات أولاً.') : undefined}
        className={
          'min-h-[40px] min-w-[88px] sm:min-w-[100px] touch-manipulation rounded-xl font-bold text-sm sm:min-h-[44px] sm:min-w-[120px] sm:text-base cursor-pointer ' +
          (isOnline
            ? 'bg-green-600 hover:bg-green-700 text-white active:bg-green-800 border-0'
            : 'border-2 border-slate-600 bg-slate-800/80 text-slate-300 hover:border-slate-500 hover:bg-slate-800 active:bg-slate-700') +
          (showCannotOffline ? ' opacity-80' : '') +
          ' disabled:opacity-70 disabled:cursor-not-allowed'
        }
      >
        {updating ? '...' : !isOnline && cannotGoOnline ? t('Enable notifications first', 'فعّل الإشعارات أولاً') : isOnline ? t('Online', 'متصل') : t('Offline', 'غير متصل')}
      </button>
    </div>
  )
}
