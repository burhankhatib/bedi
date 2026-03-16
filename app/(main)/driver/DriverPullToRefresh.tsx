'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { RefreshCw, ArrowDown } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'

const REFRESH_THRESHOLD = 80
const FORCE_RELOAD_THRESHOLD = 150
const MAX_PULL = 180

/**
 * Layout-level pull-to-refresh for driver pages other than Orders.
 * Orders has its own enhanced pull-to-refresh in DriverOrdersV2.
 * Light pull = router.refresh(), Strong pull = window.location.reload() to recover from freezes.
 */
export function DriverPullToRefresh({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useLanguage()
  const [startY, setStartY] = useState<number | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isForceReloading, setIsForceReloading] = useState(false)

  const isOrdersPage = pathname === '/driver/orders'
  if (isOrdersPage) return <>{children}</>

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 0) setStartY(e.touches[0].clientY)
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY !== null && window.scrollY <= 0) {
      const dist = e.touches[0].clientY - startY
      if (dist > 0) setPullDistance(Math.min(dist * 0.5, MAX_PULL))
    }
  }
  const handleTouchEnd = async () => {
    if (pullDistance > REFRESH_THRESHOLD && !isRefreshing) {
      const forceReload = pullDistance >= FORCE_RELOAD_THRESHOLD
      setIsRefreshing(true)
      setIsForceReloading(forceReload)
      setPullDistance(REFRESH_THRESHOLD)
      if (forceReload) {
        window.location.reload()
        return
      }
      router.refresh()
      setIsRefreshing(false)
    }
    setPullDistance(0)
    setStartY(null)
  }

  return (
    <div
      className="relative touch-pan-y min-h-[50vh]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-50"
        style={{ height: 0 }}
        animate={{
          y: isRefreshing ? REFRESH_THRESHOLD / 2 : pullDistance / 2,
          opacity: pullDistance > 10 || isRefreshing ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div className="bg-slate-800 border border-slate-700 rounded-full px-4 py-2 shadow-lg flex items-center justify-center -mt-6 gap-2">
          <motion.div
            animate={{
              rotate: isRefreshing
                ? 360
                : pullDistance >= FORCE_RELOAD_THRESHOLD
                  ? 180
                  : pullDistance > REFRESH_THRESHOLD
                    ? 90
                    : 0,
            }}
            transition={
              isRefreshing
                ? { repeat: Infinity, duration: 1, ease: 'linear' }
                : { type: 'spring', stiffness: 200, damping: 20 }
            }
          >
            {isRefreshing ? (
              <RefreshCw className="w-5 h-5 text-emerald-400" />
            ) : (
              <ArrowDown
                className={`w-5 h-5 ${pullDistance >= FORCE_RELOAD_THRESHOLD ? 'text-amber-400' : pullDistance > REFRESH_THRESHOLD ? 'text-emerald-400' : 'text-slate-400'}`}
              />
            )}
          </motion.div>
          {!isRefreshing && pullDistance > 0 && (
            <span
              className={`text-sm font-bold ${pullDistance >= FORCE_RELOAD_THRESHOLD ? 'text-amber-400' : pullDistance > REFRESH_THRESHOLD ? 'text-emerald-400' : 'text-slate-400'}`}
            >
              {pullDistance >= FORCE_RELOAD_THRESHOLD
                ? t('Release to force reload', 'أفلت لإعادة التحميل')
                : pullDistance > REFRESH_THRESHOLD
                  ? t('Release to refresh', 'أفلت للتحديث')
                  : t('Pull to refresh', 'اسحب للتحديث')}
            </span>
          )}
          {isRefreshing && (
            <span className={`text-sm font-bold ${isForceReloading ? 'text-amber-400' : 'text-emerald-400'}`}>
              {isForceReloading
                ? t('Reloading...', 'جاري إعادة التحميل...')
                : t('Refreshing...', 'جاري التحديث...')}
            </span>
          )}
        </div>
      </motion.div>
      {children}
    </div>
  )
}
