'use client'

import { useDriverStatus } from './DriverStatusContext'
import { useLanguage } from '@/components/LanguageContext'
import { ShieldAlert, ShieldCheck } from 'lucide-react'

export function DriverDashboardNav() {
  const { t } = useLanguage()
  const {
    isOnline,
    isVerifiedByAdmin,
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

  if (loading) return <div className="h-10 w-24 animate-pulse rounded-full bg-slate-800/50"></div>
  
  return (
    <div className="flex items-center gap-2">
      {/* Contextual hint — desktop only */}
      <div className="hidden sm:flex flex-col items-end mr-1 rtl:ml-1 rtl:mr-0">
        {showCannotOffline && (
          <span className="text-[10px] font-medium text-amber-400">
            {t('Complete deliveries first', 'أكمل التوصيلات أولاً')}
          </span>
        )}
        {!isVerifiedByAdmin && !isOnline && (
          <span className="text-[10px] font-medium text-amber-400">
            {t('Profile under review', 'الملف قيد المراجعة')}
          </span>
        )}
        {isVerifiedByAdmin && cannotGoOnline && !isOnline && (
          <span className="text-[10px] font-medium text-rose-400">
            {t('Enable notifications first', 'فعّل الإشعارات أولاً')}
          </span>
        )}
        {isVerifiedByAdmin && !isOnline && !cannotGoOnline && (
          <span className="text-xs font-medium text-slate-400">
            {t('Go online to get orders', 'اتصل لاستقبال الطلبات')}
          </span>
        )}
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleToggle()
          }}
          onPointerDown={(e) => e.currentTarget.releasePointerCapture?.(e.pointerId)}
          disabled={updating || (isOnline && !canGoOffline) || (!isOnline && cannotGoOnline)}
          className={`relative flex items-center justify-center h-10 px-4 sm:px-5 sm:h-11 rounded-full font-bold text-sm sm:text-base transition-all duration-300 shadow-sm touch-manipulation disabled:cursor-not-allowed ${
            isOnline
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          } ${(showCannotOffline || (cannotGoOnline && !isOnline)) ? 'opacity-70' : 'opacity-100'}`}
        >
          <div className="flex items-center gap-2">
            {isVerifiedByAdmin ? (
              <ShieldCheck className="size-4 shrink-0 text-emerald-500 bg-white rounded-full" />
            ) : (
              <ShieldAlert className="size-4 shrink-0 text-slate-400" />
            )}
            <span className={`relative flex h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full ${isOnline ? 'bg-slate-950' : 'bg-slate-500'}`}>
              {isOnline && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-950 opacity-40"></span>}
            </span>
            {updating ? t('Wait...', 'انتظر...') : isOnline ? t('Online', 'متصل') : t('Offline', 'غير متصل')}
          </div>
        </button>
        {/* Live online duration — always visible when online */}
        {isOnline && duration && (
          <span className="text-[10px] font-mono font-semibold text-emerald-400 tabular-nums leading-none tracking-wide">
            {duration}
          </span>
        )}
      </div>
    </div>
  )
}
