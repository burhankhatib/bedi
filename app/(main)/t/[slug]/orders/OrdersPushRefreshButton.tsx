'use client'

import { useState } from 'react'
import { RefreshCw, BellOff, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/ToastProvider'
import { useTenantPush } from '@/app/(main)/t/[slug]/manage/TenantPushContext'

/**
 * A small, always-visible notification status chip on the orders page.
 * When push is active → shows green "active" indicator with a hidden refresh button on hover.
 * When push is missing → shows an amber "Enable" button.
 * Gives tenants and staff a single tap to fix stale FCM tokens without leaving the page.
 */
export function OrdersPushRefreshButton() {
  const { hasPush, loading, isDenied, subscribe, refreshToken } = useTenantPush()
  const { showToast } = useToast()
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

  if (hasPush) {
    return (
      <div className="mb-3 flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-800/60 bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-400">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          الإشعارات مفعّلة
        </div>
      </div>
    )
  }

  if (isDenied) {
    return (
      <div className="mb-3 flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-amber-800/50 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-400">
          <BellOff className="size-3.5" />
          الإشعارات محجوبة
        </div>
        <span className="text-xs text-slate-500">
          Chrome → أيقونة القفل → الإشعارات → سماح
        </span>
      </div>
    )
  }

  return (
    <div className="mb-3">
      <Button
        type="button"
        size="sm"
        disabled={loading || isRefreshing}
        onClick={() => subscribe()}
        className="h-8 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium"
      >
        <Bell className="size-3.5 mr-1.5" />
        {loading ? 'جاري التفعيل…' : 'تفعيل الإشعارات'}
      </Button>
    </div>
  )
}
