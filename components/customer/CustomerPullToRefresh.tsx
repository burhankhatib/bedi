'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { RefreshCw, ArrowDown } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'

const REFRESH_THRESHOLD = 80
const FORCE_RELOAD_THRESHOLD = 150
const MAX_PULL = 180
/** Minimum seconds between refresh triggers. Prevents Sanity API spike when user repeatedly pulls. */
const MIN_REFRESH_INTERVAL_MS = 30_000

function isAtTop(): boolean {
  if (typeof window === 'undefined') return true
  return window.scrollY <= 5 || document.documentElement.scrollTop <= 5
}

/** iOS PWA uses pulltorefreshjs (CustomerIOSPullToRefresh); skip custom pull to avoid conflicts. */
function isIOSStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false
  return (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

/** Skip pull when a modal/sheet has body scroll locked (avoids touch conflict and freeze). */
function isOverlayOpen(): boolean {
  if (typeof document === 'undefined') return false
  return document.body.style.overflow === 'hidden' || !!document.body.getAttribute('data-scroll-locked')
}

/**
 * Customer PWA pull-to-refresh. Light pull = router.refresh(), Strong pull = window.location.reload() to recover from freezes.
 * On iOS PWA, pulltorefreshjs handles this – we passthrough.
 */
export function CustomerPullToRefresh({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useLanguage()
  const [startY, setStartY] = useState<number | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isForceReloading, setIsForceReloading] = useState(false)
  const startYRef = useRef<number | null>(null)
  const setPullDistanceRef = useRef((n: number) => setPullDistance(n))
  const lastRefreshAtRef = useRef<number>(0)

  if (isIOSStandalonePWA()) return <>{children}</>

  setPullDistanceRef.current = setPullDistance
  startYRef.current = startY

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isOverlayOpen()) return
    if (isAtTop()) {
      const y = e.touches[0].clientY
      setStartY(y)
      startYRef.current = y
    } else {
      setStartY(null)
      startYRef.current = null
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isOverlayOpen()) return
    const sy = startYRef.current
    if (sy === null || !isAtTop()) return
    const dist = e.touches[0].clientY - sy
    if (dist > 0) {
      e.preventDefault()
      setPullDistanceRef.current(Math.min(dist * 0.5, MAX_PULL))
    }
  }, [])

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onMove = (e: TouchEvent) => {
      if (isOverlayOpen()) return
      const sy = startYRef.current
      if (sy === null) return
      if (!isAtTop()) {
        setStartY(null)
        startYRef.current = null
        return
      }
      const dist = e.touches[0].clientY - sy
      if (dist > 0) {
        e.preventDefault()
        setPullDistanceRef.current(Math.min(dist * 0.5, MAX_PULL))
      }
    }
    el.addEventListener('touchmove', onMove, { passive: false })
    return () => el.removeEventListener('touchmove', onMove)
  }, [])

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > REFRESH_THRESHOLD && !isRefreshing) {
      const forceReload = pullDistance >= FORCE_RELOAD_THRESHOLD
      const now = Date.now()
      const elapsed = now - lastRefreshAtRef.current
      if (elapsed < MIN_REFRESH_INTERVAL_MS && !forceReload) {
        // Throttle: skip refresh if we refreshed recently (reduces Sanity API spikes)
        setPullDistance(0)
        setStartY(null)
        return
      }
      setIsRefreshing(true)
      setIsForceReloading(forceReload)
      setPullDistance(REFRESH_THRESHOLD)
      lastRefreshAtRef.current = now
      if (forceReload) {
        window.location.reload()
        return
      }
      router.refresh()
      setIsRefreshing(false)
    }
    setPullDistance(0)
    setStartY(null)
  }, [pullDistance, isRefreshing, router])

  return (
    <div
      ref={containerRef}
      className="relative min-h-[50vh] overflow-visible touch-manipulation"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: pullDistance > 0 ? 'none' : 'pan-y' }}
    >
      {/* Pull-to-refresh indicator - fixed at top, customer styling (light theme) */}
      <motion.div
        className="absolute left-0 right-0 flex justify-center pointer-events-none z-[100]"
        style={{ top: 0, height: 0 }}
        animate={{
          y: isRefreshing ? REFRESH_THRESHOLD / 2 : Math.min(pullDistance / 2, 90),
          opacity: pullDistance > 5 || isRefreshing ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div className="flex items-center justify-center gap-2 rounded-full bg-white border border-slate-200 px-4 py-2.5 shadow-xl -translate-y-2 min-w-[160px]">
          {isRefreshing ? (
            <RefreshCw className="w-5 h-5 shrink-0 animate-spin text-amber-600" />
          ) : (
            <motion.div
              animate={{
                rotate: pullDistance >= FORCE_RELOAD_THRESHOLD ? 180 : pullDistance > REFRESH_THRESHOLD ? 90 : 0,
              }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <ArrowDown
                className={`w-5 h-5 shrink-0 ${
                  pullDistance >= FORCE_RELOAD_THRESHOLD ? 'text-amber-600' : pullDistance > REFRESH_THRESHOLD ? 'text-amber-500' : 'text-slate-400'
                }`}
              />
            </motion.div>
          )}
          <span
            className={`text-sm font-bold whitespace-nowrap ${
              isRefreshing
                ? isForceReloading ? 'text-amber-600' : 'text-amber-600'
                : pullDistance >= FORCE_RELOAD_THRESHOLD ? 'text-amber-600' : pullDistance > REFRESH_THRESHOLD ? 'text-amber-600' : 'text-slate-500'
            }`}
          >
            {isRefreshing
              ? (isForceReloading ? t('Reloading...', 'جاري إعادة التحميل...') : t('Refreshing...', 'جاري التحديث...'))
              : pullDistance >= FORCE_RELOAD_THRESHOLD
                ? t('Release to force reload', 'أفلت لإعادة التحميل')
                : pullDistance > REFRESH_THRESHOLD
                  ? t('Release to refresh', 'أفلت للتحديث')
                  : t('Pull to refresh', 'اسحب للتحديث')}
          </span>
        </div>
      </motion.div>
      {children}
    </div>
  )
}
