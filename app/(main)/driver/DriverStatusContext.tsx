'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePusherStream } from '@/lib/usePusherStream'
import { useAuth } from '@clerk/nextjs'
import { useDriverPush } from './DriverPushContext'
import { useToast } from '@/components/ui/ToastProvider'
import { useLanguage } from '@/components/LanguageContext'

function formatOnlineDuration(onlineSince: string | undefined, t: (en: string, ar: string) => string): string {
  if (!onlineSince) return ''
  const start = new Date(onlineSince).getTime()
  const now = Date.now()
  const ms = Math.max(0, now - start)
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}

const SKIP_APPLY_MS = 3500
const DRIVER_STATUS_FETCH_MS = 20000

type DriverStatusContextValue = {
  isOnline: boolean
  isVerifiedByAdmin: boolean
  onlineSince: string | undefined
  activeDeliveriesCount: number
  loading: boolean
  updating: boolean
  duration: string
  canGoOffline: boolean
  showCannotOffline: boolean
  cannotGoOnline: boolean
  toggle: () => Promise<void>
  fetchStatus: () => Promise<void>
}

const DriverStatusContext = createContext<DriverStatusContextValue | null>(null)

export function useDriverStatus(): DriverStatusContextValue {
  const ctx = useContext(DriverStatusContext)
  if (!ctx) {
    return {
      isOnline: false,
      isVerifiedByAdmin: false,
      onlineSince: undefined,
      activeDeliveriesCount: 0,
      loading: true,
      updating: false,
      duration: '',
      canGoOffline: true,
      showCannotOffline: false,
      cannotGoOnline: true,
      toggle: async () => {},
      fetchStatus: async () => {},
    }
  }
  return ctx
}

export function DriverStatusProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage()
  const { hasPush } = useDriverPush()
  const { showToast } = useToast()
  const [isOnline, setIsOnline] = useState(false)
  const [isVerifiedByAdmin, setIsVerifiedByAdmin] = useState(false)
  const [onlineSince, setOnlineSince] = useState<string | undefined>()
  const [activeDeliveriesCount, setActiveDeliveriesCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [duration, setDuration] = useState('')
  const skipStatusApplyUntilRef = useRef(0)

  const { userId } = useAuth()

  const fetchStatus = useCallback(() => {
    const ctrl = new AbortController()
    const tid = window.setTimeout(() => ctrl.abort(), DRIVER_STATUS_FETCH_MS)
    return fetch('/api/driver/status', { credentials: 'include', signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        const skipApply = Date.now() < skipStatusApplyUntilRef.current
        if (skipApply) {
          if (typeof data?.activeDeliveriesCount === 'number') setActiveDeliveriesCount(data.activeDeliveriesCount)
          return
        }
        if (data && typeof data.isOnline === 'boolean') setIsOnline(data.isOnline)
        if (data && typeof data.isVerifiedByAdmin === 'boolean') setIsVerifiedByAdmin(data.isVerifiedByAdmin)
        if (data?.onlineSince != null) setOnlineSince(data.onlineSince)
        if (typeof data?.activeDeliveriesCount === 'number') setActiveDeliveriesCount(data.activeDeliveriesCount)
        if (data?.autoOfflined === true) {
          showToast(
            t(
              "You were set to offline after 8 hours. Switch to Online again if you want to receive delivery requests.",
              "تم إيقاف الاتصال بعد 8 ساعات. اختر «متصل» مرة أخرى إذا أردت استقبال طلبات التوصيل."
            ),
            undefined,
            'info'
          )
        }
      })
      .catch(() => {})
      .finally(() => {
        window.clearTimeout(tid)
        setLoading(false)
      })
  }, [t, showToast])

  useEffect(() => {
    fetchStatus()
    const onFocus = () => fetchStatus()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchStatus])

  // Real-time: refetch when driver document changes (toggle, auto-offline). No polling.
  usePusherStream(userId ? `driver-${userId}` : null, 'driver-update', fetchStatus)

  useEffect(() => {
    if (!isOnline || !onlineSince) {
      setDuration('')
      return
    }
    const update = () => setDuration(formatOnlineDuration(onlineSince, t))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [isOnline, onlineSince, t])

  const toggle = useCallback(async () => {
    if (isOnline && activeDeliveriesCount > 0) return
    if (updating) return
    const nextOnline = !isOnline
    const prevOnline = isOnline
    const prevOnlineSince = onlineSince
    skipStatusApplyUntilRef.current = Date.now() + SKIP_APPLY_MS
    setIsOnline(nextOnline)
    setOnlineSince(nextOnline ? new Date().toISOString() : undefined)
    setUpdating(true)
    try {
      const res = await fetch('/api/driver/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOnline: nextOnline }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && typeof data.isOnline === 'boolean') {
        setIsOnline(data.isOnline)
        setOnlineSince(data.onlineSince ?? undefined)
        if (typeof data?.activeDeliveriesCount === 'number') setActiveDeliveriesCount(data.activeDeliveriesCount)
        if (nextOnline && data.isOnline === true) {
          // Hard refresh when going online to flush all stale state and re-subscribe cleanly
          setTimeout(() => { window.location.reload() }, 400)
          return
        }
        setTimeout(() => {
          skipStatusApplyUntilRef.current = 0
          fetchStatus()
        }, 2000)
      } else {
        skipStatusApplyUntilRef.current = 0
        setIsOnline(prevOnline)
        setOnlineSince(prevOnlineSince)
        if (res.status === 400 && data?.error === 'push_required') {
          showToast(t('Enable notifications from the Orders page first.', 'فعّل الإشعارات من صفحة الطلبات أولاً.'), undefined, 'info')
        } else if (res.status === 400 && typeof data?.activeDeliveriesCount === 'number') {
          setActiveDeliveriesCount(data.activeDeliveriesCount)
        }
        fetchStatus()
      }
    } catch {
      skipStatusApplyUntilRef.current = 0
      setIsOnline(prevOnline)
      setOnlineSince(prevOnlineSince)
      fetchStatus()
    } finally {
      setUpdating(false)
    }
  }, [isOnline, activeDeliveriesCount, updating, onlineSince, t, showToast, fetchStatus])

  const canGoOffline = activeDeliveriesCount === 0
  const showCannotOffline = isOnline && !canGoOffline
  const cannotGoOnline = !hasPush || !isVerifiedByAdmin

  const value: DriverStatusContextValue = {
    isOnline,
    isVerifiedByAdmin,
    onlineSince,
    activeDeliveriesCount,
    loading,
    updating,
    duration,
    canGoOffline,
    showCannotOffline,
    cannotGoOnline,
    toggle,
    fetchStatus,
  }

  return (
    <DriverStatusContext.Provider value={value}>
      {children}
    </DriverStatusContext.Provider>
  )
}
