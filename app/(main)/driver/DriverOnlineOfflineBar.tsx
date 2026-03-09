'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useDriverStatus } from './DriverStatusContext'
import { useLanguage } from '@/components/LanguageContext'

const EXPANDED_DURATION_MS = 5000

const t = {
  onlineForEn: 'Online for',
  onlineForAr: 'متصل منذ',
  onlineEn: 'Online',
  onlineAr: 'متصل',
  offlineCtaEn: 'You are offline! Go Online Now',
  offlineCtaAr: 'أنت غير متصل! ادخل متصل الآن',
  offlineEn: 'Offline',
  offlineAr: 'غير متصل',
  loadingEn: 'Loading…',
  loadingAr: 'جاري التحميل…',
  completeDeliveriesEn: 'Complete or cancel your deliveries first.',
  completeDeliveriesAr: 'أكمل أو ألغِ توصيلاتك أولاً.',
  enableNotificationsEn: 'Enable notifications from the Orders page first.',
  enableNotificationsAr: 'فعّل الإشعارات من صفحة الطلبات أولاً.',
  profileUnderReviewEn: 'Profile is under review. Please wait for verification.',
  profileUnderReviewAr: 'الملف قيد المراجعة. يرجى انتظار التوثيق.',
}

export function DriverOnlineOfflineBar() {
  const { t: tLang } = useLanguage()
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
  const [expanded, setExpanded] = useState(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When status or isOnline changes, show expanded for 5s then shrink
  useEffect(() => {
    const t = setTimeout(() => setExpanded(true), 0)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setExpanded(false)
      timeoutRef.current = null
    }, EXPANDED_DURATION_MS)
    return () => {
      clearTimeout(t)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [isOnline, duration])

  const disabled = updating || (isOnline && !canGoOffline) || (!isOnline && cannotGoOnline)
  const title = showCannotOffline
    ? tLang(t.completeDeliveriesEn, t.completeDeliveriesAr)
    : !isVerifiedByAdmin
      ? tLang(t.profileUnderReviewEn, t.profileUnderReviewAr)
      : !isOnline && cannotGoOnline
        ? tLang(t.enableNotificationsEn, t.enableNotificationsAr)
        : undefined

  const loadingText = tLang(t.loadingEn, t.loadingAr)
  const expandedOnlineText = isOnline ? `${tLang(t.onlineForEn, t.onlineForAr)} ${duration || (tLang('0 min', '0 د'))}` : tLang(t.offlineCtaEn, t.offlineCtaAr)
  const compactOnlineText = isOnline ? tLang(t.onlineEn, t.onlineAr) : tLang(t.offlineEn, t.offlineAr)

  if (loading) {
    return (
      <div
        className="w-full border-b border-slate-800 bg-slate-900/80 px-4 py-3 text-center text-sm text-slate-500"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        {loadingText}
      </div>
    )
  }

  return (
    <div
      className="w-full border-b border-slate-800 bg-slate-950/98 backdrop-blur-sm px-4 pb-3 pt-2"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
    >
      <div className="flex w-full justify-center">
        <motion.button
          type="button"
          onClick={toggle}
          disabled={disabled}
          title={title}
          className={
            'touch-manipulation rounded-xl font-bold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-70 flex min-h-[48px] items-center justify-center overflow-hidden ' +
            (isOnline
              ? 'bg-green-600 text-white hover:bg-green-500 active:bg-green-700'
              : 'border-2 border-slate-600 bg-slate-800/80 text-slate-300 hover:border-slate-500 hover:bg-slate-800 active:bg-slate-700')
          }
          initial={false}
          animate={{
            width: expanded ? '100%' : '7rem',
          }}
          transition={{
            type: 'spring',
            stiffness: 380,
            damping: 28,
          }}
        >
          <span className="px-4 py-3">
            <AnimatePresence mode="wait">
              {expanded ? (
                <motion.span
                  key="expanded"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="block truncate"
                >
                  {updating ? '...' : expandedOnlineText}
                </motion.span>
              ) : (
                <motion.span
                  key="compact"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="block"
                >
                  {updating ? '...' : compactOnlineText}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </motion.button>
      </div>
    </div>
  )
}
