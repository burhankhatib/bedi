'use client'

/**
 * Unified push notification & PWA status card for Business, Driver, and Customer.
 * Placed at bottom of main content. When PWA is installed, includes reinstall help (moved from header).
 */
import { useState } from 'react'
import { Bell, BellOff, RefreshCw, Loader2, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'
import { isStandaloneMode } from '@/lib/pwa/detect'
import { PWAReinstallHelp } from '@/components/pwa/PWAReinstallHelp'
import type { PWAConfig } from '@/lib/pwa/types'

export type PushStatus = 'checking' | 'connected' | 'stale' | 'disconnected' | 'denied'

export type PushStatusCardProps = {
  variant: 'business' | 'driver' | 'customer-track'
  /** Push status from context */
  status: PushStatus
  loading?: boolean
  isDenied?: boolean
  needsIOSHomeScreen?: boolean
  /** Subscribe/enable push */
  onSubscribe: () => Promise<boolean>
  /** Refresh token (re-register) */
  onRefresh: () => Promise<boolean>
  /** PWA config for reinstall help when standalone */
  pwaConfig?: PWAConfig
  /** Light theme for customer pages (track, my-orders) */
  theme?: 'dark' | 'light'
}

const MAX_RETRIES = 3
const RETRY_STORAGE_PREFIX = 'push_retries_'

function getRetryKey(variant: string, slug?: string): string {
  if (variant === 'customer-track' && slug) return RETRY_STORAGE_PREFIX + `track_${slug}`
  return RETRY_STORAGE_PREFIX + variant
}

function getRetryCount(key: string): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = sessionStorage.getItem(key)
    return typeof raw === 'string' ? parseInt(raw, 10) || 0 : 0
  } catch {
    return 0
  }
}

function incrementRetry(key: string): number {
  if (typeof window === 'undefined') return 0
  try {
    const count = getRetryCount(key) + 1
    sessionStorage.setItem(key, String(count))
    return count
  } catch {
    return 1
  }
}

function resetRetry(key: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function PushStatusCard({
  variant,
  status,
  loading = false,
  isDenied = false,
  needsIOSHomeScreen = false,
  onSubscribe,
  onRefresh,
  pwaConfig,
  slug,
  theme = 'dark',
}: PushStatusCardProps & { slug?: string }) {
  const { t, lang } = useLanguage()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showManualInstructions, setShowManualInstructions] = useState(false)
  const retryKey = getRetryKey(variant, slug)
  const retryCount = getRetryCount(retryKey)
  const isStandalone = isStandaloneMode()
  const isRtl = lang === 'ar'

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const ok = await onRefresh()
      if (ok) resetRetry(retryKey)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSubscribe = async () => {
    const ok = await onSubscribe()
    if (!ok) {
      const count = incrementRetry(retryKey)
      if (count >= MAX_RETRIES) setShowManualInstructions(true)
    } else {
      resetRetry(retryKey)
    }
  }

  const labels = {
    business: {
      active: t('Notifications active', 'الإشعارات مفعّلة'),
      checking: t('Checking…', 'جاري التحقق…'),
      denied: t('Notifications blocked', 'الإشعارات محجوبة'),
      disconnected: t('Notifications disconnected', 'الإشعارات غير متصلة'),
      enable: t('Enable notifications', 'تفعيل الإشعارات'),
      refreshing: t('Refreshing…', 'جاري التحديث…'),
      refresh: t('Refresh', 'تحديث'),
    },
    driver: {
      active: t('Notifications active', 'الإشعارات مفعّلة'),
      checking: t('Checking…', 'جاري التحقق…'),
      denied: t('Notifications blocked', 'الإشعارات محجوبة'),
      disconnected: t('Notifications disconnected', 'الإشعارات غير متصلة'),
      enable: t('Enable notifications', 'تفعيل الإشعارات'),
      refreshing: t('Refreshing…', 'جاري التحديث…'),
      refresh: t('Refresh', 'تحديث'),
    },
    'customer-track': {
      active: t('Notifications enabled', 'الإشعارات مفعّلة'),
      checking: t('Checking…', 'جاري التحقق…'),
      denied: t('Notifications blocked', 'الإشعارات محجوبة'),
      disconnected: t('Notifications disconnected', 'الإشعارات غير متصلة'),
      enable: t('Enable status notifications', 'تفعيل إشعارات الحالة'),
      refreshing: t('Refreshing…', 'جاري التحديث…'),
      refresh: t('Refresh', 'تحديث'),
    },
  }

  const L = labels[variant]
  const manualInstructions = t(
    'To enable manually: open browser or device Settings → find this site → allow Notifications.',
    'للتشغيل يدوياً: افتح إعدادات المتصفح أو الجهاز → ابحث عن هذا الموقع → اسمح بالإشعارات.'
  )

  const isLight = theme === 'light'
  const cardClass = isLight
    ? 'mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-4'
    : 'mt-6 rounded-2xl border border-slate-700/60 bg-slate-900/50 px-4 py-4'
  const iconBgClass = isLight ? 'bg-slate-100' : 'bg-slate-800/80'
  const iconClass = isLight ? 'text-slate-600' : 'text-slate-400'
  const titleClass = isLight ? 'text-slate-800' : 'text-white'

  return (
    <div className={cardClass} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconBgClass}`}>
          <Smartphone className={`size-6 ${iconClass}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${titleClass}`}>{t('App & notifications', 'التطبيق والإشعارات')}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {/* Status */}
            {status === 'checking' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600/60 bg-slate-800/60 px-3 py-1 text-xs text-slate-400">
                <Loader2 className="size-3.5 animate-spin" />
                {L.checking}
              </span>
            )}
            {(status === 'connected' || status === 'stale') && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/60 bg-emerald-950/30 px-3 py-1 text-xs text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {L.active}
              </span>
            )}
            {status === 'denied' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/60 bg-amber-950/30 px-3 py-1 text-xs text-amber-400">
                <BellOff className="size-3.5" />
                {L.denied}
              </span>
            )}
            {(status === 'disconnected') && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-800/50 bg-red-950/30 px-3 py-1 text-xs text-red-400">
                <BellOff className="size-3.5" />
                {L.disconnected}
              </span>
            )}

            {/* Actions */}
            {(status === 'connected' || status === 'stale') && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isRefreshing || loading}
                onClick={handleRefresh}
                className="h-8 gap-1.5 rounded-full px-3 text-xs text-emerald-400 hover:bg-emerald-900/40 hover:text-emerald-300"
              >
                <RefreshCw className={`size-3.5 ${isRefreshing || loading ? 'animate-spin' : ''}`} />
                {isRefreshing || loading ? L.refreshing : L.refresh}
              </Button>
            )}
            {(status === 'disconnected' || status === 'denied') && !showManualInstructions && retryCount < MAX_RETRIES && (
              <Button
                type="button"
                size="sm"
                disabled={loading || (isDenied && !needsIOSHomeScreen)}
                onClick={handleSubscribe}
                className="h-8 gap-1.5 rounded-full bg-amber-500 px-3 text-xs font-medium text-slate-950 hover:bg-amber-400"
              >
                <Bell className="size-3.5" />
                {loading ? L.refreshing : L.enable}
              </Button>
            )}
          </div>
          {showManualInstructions && (status === 'disconnected' || status === 'denied') && (
            <p className={`mt-2 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{manualInstructions}</p>
          )}
        </div>
        {/* PWA Reinstall: only when standalone, moved from header */}
        {isStandalone && pwaConfig && (
          <div className="shrink-0">
            <PWAReinstallHelp config={pwaConfig} variant="icon" className="h-9 w-9" />
          </div>
        )}
      </div>
    </div>
  )
}
