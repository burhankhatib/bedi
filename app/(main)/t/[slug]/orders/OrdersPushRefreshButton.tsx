'use client'

import { useState } from 'react'
import { RefreshCw, BellOff, Bell, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/ToastProvider'
import { useTenantPush } from '@/app/(main)/t/[slug]/manage/TenantPushContext'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * A small, always-visible notification status chip on the orders page.
 * Uses 4 states: checking, connected, disconnected (or stale), denied.
 */
export function OrdersPushRefreshButton() {
  const { tokenStatus, loading, subscribe, refreshToken } = useTenantPush()
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

  return (
    <div className="mb-3 h-8 flex items-center">
      <AnimatePresence mode="wait">
        {tokenStatus === 'checking' && (
          <motion.div
            key="checking"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5 rounded-full border border-blue-800/50 bg-blue-950/30 px-3 py-1.5 text-xs text-blue-400"
          >
            <Loader2 className="size-3.5 animate-spin" />
            جاري التحقق من الإشعارات...
          </motion.div>
        )}

        {tokenStatus === 'connected' && (
          <motion.div
            key="connected"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 group"
          >
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-800/60 bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-400 shadow-sm transition-colors group-hover:border-emerald-700/60 group-hover:bg-emerald-900/40">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              الإشعارات مفعّلة
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || loading}
                className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-emerald-800/50 disabled:opacity-50"
                title="Refresh Push Connection"
              >
                <RefreshCw className={`size-3 ${isRefreshing || loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </motion.div>
        )}

        {tokenStatus === 'denied' && (
          <motion.div
            key="denied"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2"
          >
            <div className="flex items-center gap-1.5 rounded-full border border-amber-800/50 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-400">
              <BellOff className="size-3.5" />
              الإشعارات محجوبة
            </div>
            <span className="text-xs text-slate-500">
              Chrome → أيقونة القفل → الإشعارات → سماح
            </span>
          </motion.div>
        )}

        {(tokenStatus === 'disconnected' || tokenStatus === 'stale') && (
          <motion.div
            key="disconnected"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2"
          >
            <div className="flex items-center gap-1.5 rounded-full border border-red-800/50 bg-red-950/30 px-3 py-1.5 text-xs text-red-400 mr-2">
              <BellOff className="size-3.5" />
              الإشعارات غير متصلة
            </div>
            <Button
              type="button"
              size="sm"
              disabled={loading || isRefreshing}
              onClick={handleRefresh}
              className="h-7 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-full px-3"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${loading || isRefreshing ? 'animate-spin' : ''}`} />
              إعادة الاتصال
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
