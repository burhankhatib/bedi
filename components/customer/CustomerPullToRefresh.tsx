'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { RefreshCw, ArrowDown } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { isStandaloneMode } from '@/lib/pwa/detect'

const REFRESH_THRESHOLD = 72
const FORCE_RELOAD_THRESHOLD = 140
const MAX_PULL = 170
/** Soft refresh throttle (force-reload always allowed). */
const MIN_SOFT_REFRESH_INTERVAL_MS = 4000

function isAtTop(): boolean {
  if (typeof window === 'undefined') return true
  return window.scrollY <= 6 || document.documentElement.scrollTop <= 6
}

/** iOS home-screen PWA uses pulltorefreshjs (CustomerIOSPullToRefresh). */
function isIOSStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false
  return (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

function isOverlayOpen(): boolean {
  if (typeof document === 'undefined') return false
  return document.body.style.overflow === 'hidden' || !!document.body.getAttribute('data-scroll-locked')
}

async function lightHaptic(): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return
    const { ImpactStyle, Haptics } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    /* optional */
  }
}

/**
 * Pull-to-refresh for **Capacitor customer shell** and **installed PWAs** (Android / non-iOS-Safari-standalone).
 * Uses document-level capture listeners so it works when the WebView scrolls the document (wrapper-only listeners often miss).
 * Light pull → `router.refresh()`; long pull → full reload.
 */
export function CustomerPullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { t } = useLanguage()
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isForceReloading, setIsForceReloading] = useState(false)
  const [shellEnabled, setShellEnabled] = useState(false)

  const startYRef = useRef<number | null>(null)
  const pullDistanceRef = useRef(0)
  const isRefreshingRef = useRef(false)
  const lastRefreshAtRef = useRef(0)

  pullDistanceRef.current = pullDistance
  isRefreshingRef.current = isRefreshing

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isIOSStandalonePWA()) {
      setShellEnabled(false)
      return
    }
    let cancelled = false
    import('@capacitor/core').then(({ Capacitor }) => {
      if (cancelled) return
      const native = Capacitor.isNativePlatform()
      const standalone = isStandaloneMode()
      setShellEnabled(native || standalone)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!shellEnabled) return

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      if (isOverlayOpen() || isRefreshingRef.current) return
      if (!isAtTop()) {
        startYRef.current = null
        return
      }
      startYRef.current = e.touches[0].clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      if (isOverlayOpen() || isRefreshingRef.current) return
      const sy = startYRef.current
      if (sy === null) return
      if (!isAtTop()) {
        startYRef.current = null
        setPullDistance(0)
        return
      }
      const dist = e.touches[0].clientY - sy
      if (dist > 0) {
        e.preventDefault()
        setPullDistance(Math.min(dist * 0.48, MAX_PULL))
      } else if (dist < -8) {
        startYRef.current = null
        setPullDistance(0)
      }
    }

    const onTouchEnd = () => {
      const dist = pullDistanceRef.current
      startYRef.current = null

      if (dist <= REFRESH_THRESHOLD || isRefreshingRef.current) {
        setPullDistance(0)
        return
      }

      const forceReload = dist >= FORCE_RELOAD_THRESHOLD
      const now = Date.now()
      if (!forceReload && now - lastRefreshAtRef.current < MIN_SOFT_REFRESH_INTERVAL_MS) {
        setPullDistance(0)
        return
      }

      lastRefreshAtRef.current = now
      void lightHaptic()

      if (forceReload) {
        setIsForceReloading(true)
        setIsRefreshing(true)
        setPullDistance(REFRESH_THRESHOLD)
        window.location.reload()
        return
      }

      setIsRefreshing(true)
      setPullDistance(REFRESH_THRESHOLD)
      void (async () => {
        try {
          await router.refresh()
        } finally {
          setIsRefreshing(false)
          setIsForceReloading(false)
          setPullDistance(0)
        }
      })()
    }

    const opts: AddEventListenerOptions = { capture: true, passive: false }
    document.addEventListener('touchstart', onTouchStart, opts)
    document.addEventListener('touchmove', onTouchMove, opts)
    document.addEventListener('touchend', onTouchEnd, opts)
    document.addEventListener('touchcancel', onTouchEnd, opts)

    return () => {
      document.removeEventListener('touchstart', onTouchStart, opts)
      document.removeEventListener('touchmove', onTouchMove, opts)
      document.removeEventListener('touchend', onTouchEnd, opts)
      document.removeEventListener('touchcancel', onTouchEnd, opts)
    }
  }, [shellEnabled, router])

  if (!shellEnabled) {
    return <>{children}</>
  }

  return (
    <div className="relative min-h-screen">
      <motion.div
        className="pointer-events-none fixed left-0 right-0 z-[200] flex justify-center"
        style={{ top: 'max(8px, env(safe-area-inset-top, 0px))' }}
        animate={{
          y: isRefreshing ? 8 : Math.min(pullDistance * 0.35, 72),
          opacity: pullDistance > 4 || isRefreshing ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      >
        <div className="flex min-w-[168px] items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 shadow-lg">
          {isRefreshing ? (
            <RefreshCw className="size-5 shrink-0 animate-spin text-amber-600" aria-hidden />
          ) : (
            <motion.div
              animate={{
                rotate:
                  pullDistance >= FORCE_RELOAD_THRESHOLD
                    ? 180
                    : pullDistance > REFRESH_THRESHOLD
                      ? 90
                      : 0,
              }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
            >
              <ArrowDown
                className={`size-5 shrink-0 ${
                  pullDistance >= FORCE_RELOAD_THRESHOLD
                    ? 'text-amber-600'
                    : pullDistance > REFRESH_THRESHOLD
                      ? 'text-amber-500'
                      : 'text-slate-400'
                }`}
                aria-hidden
              />
            </motion.div>
          )}
          <span
            className={`whitespace-nowrap text-sm font-bold ${
              pullDistance >= REFRESH_THRESHOLD || isRefreshing ? 'text-amber-600' : 'text-slate-500'
            }`}
          >
            {isRefreshing
              ? isForceReloading
                ? t('Reloading...', 'جاري إعادة التحميل...')
                : t('Refreshing...', 'جاري التحديث...')
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
