'use client'

/**
 * Unified Business PWA: enable push once to receive new-order notifications for ALL businesses the user owns.
 * Registers dashboard-scoped SW and saves FCM token via /api/me/business-push-subscription (saved to every tenant).
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { Button } from '@/components/ui/button'
import { Bell } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { getTenantPushSubscriptionToken } from '@/lib/tenant-push-subscribe'
import { isFirebaseConfigured } from '@/lib/firebase-config'
import { useLanguage } from '@/components/LanguageContext'
import { getStoredPushOk, setStoredPushOk, clearStoredPushOk, PUSH_CONTEXT_KEYS } from '@/lib/push-storage'

const REMIND_LATER_KEY = 'bedi-business-push-remind'
const REMIND_MS = 24 * 60 * 60 * 1000

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
}

export function BusinessPushSetup() {
  const { t, lang } = useLanguage()
  const { showToast } = useToast()
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [remindAt, setRemindAt] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const autoRef = useRef(false)

  useEffect(() => {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(REMIND_LATER_KEY) : null
    const n = raw ? parseInt(raw, 10) : NaN
    setRemindAt(Number.isFinite(n) ? n : null)
  }, [])

  const subscribe = useCallback(async () => {
    if (typeof window === 'undefined') return false
    const isNativeCheck = typeof window !== 'undefined' && Capacitor.isNativePlatform()
    if (!isNativeCheck && (!('serviceWorker' in navigator) || !('Notification' in window))) return false
    if (!isFirebaseConfigured?.()) {
      showToast('Push is not configured.', 'الإشعارات غير مُعدّة.', 'error')
      return false
    }
    setLoading(true)
    try {
      const { token: fcmToken, permissionState } = await getTenantPushSubscriptionToken(true, '/dashboard/')
      if (permissionState !== 'granted') {
        showToast(
          t('Enable notifications in device settings to get new order alerts.', 'فعّل الإشعارات من إعدادات الجهاز لاستقبال تنبيهات الطلبات.'),
          undefined,
          'info'
        )
        return false
      }
      if (!fcmToken) throw new Error('Could not get token')
      const isStandalone = () => {
        if (typeof window === 'undefined') return false
        return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
      }
      const pushClient = typeof window !== 'undefined' && Capacitor.isNativePlatform() ? 'native' : (isStandalone() ? 'pwa' : 'browser')
      const res = await fetch('/api/me/business-push-subscription', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fcmToken, pushClient }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to save')
      }
      setStoredPushOk(PUSH_CONTEXT_KEYS.business())
      setDone(true)
      if (typeof localStorage !== 'undefined') localStorage.removeItem(REMIND_LATER_KEY)
      showToast(
        t("Notifications enabled. You'll get an alert when any of your businesses receives a new order.", 'تم تفعيل الإشعارات. ستستقبل تنبيهاً عند وصول طلب جديد لأي من متاجرك.'),
        undefined,
        'success'
      )
      return true
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed', undefined, 'error')
      return false
    } finally {
      setLoading(false)
    }
  }, [showToast, t])

  useEffect(() => {
    if (autoRef.current || !checked) return
    const isNativeCheck = typeof window !== 'undefined' && Capacitor.isNativePlatform()
    if (!isNativeCheck && Notification.permission !== 'granted') return
    if (done) return
    if (!isFirebaseConfigured?.()) return
    let cancelled = false
    ;(async () => {
      try {
        const { token } = await getTenantPushSubscriptionToken(false, '/dashboard/')
        if (cancelled || !token) return
        const pushClient = typeof window !== 'undefined' && Capacitor.isNativePlatform() ? 'native' : (isStandalone() ? 'pwa' : 'browser')
        const res = await fetch('/api/me/business-push-subscription', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fcmToken: token, pushClient }),
        })
        if (res.ok) {
          setStoredPushOk(PUSH_CONTEXT_KEYS.business())
          autoRef.current = true
          setDone(true)
        }
      } catch {
        // silent
      }
    })()
    return () => { cancelled = true }
  }, [checked, done])

  useEffect(() => {
    fetch('/api/me/account-type')
      .then((r) => r.json())
      .then((data) => {
        if (data?.accountType === 'tenant') setChecked(true)
      })
      .catch(() => setChecked(true))

    const perm = typeof Notification !== 'undefined' ? Notification.permission : null
    if (perm === 'denied') {
      clearStoredPushOk(PUSH_CONTEXT_KEYS.business())
      return
    }
    if (perm === 'granted' && getStoredPushOk(PUSH_CONTEXT_KEYS.business())) {
      setDone(true)
      return
    }
    fetch('/api/me/business-push-subscription')
      .then((r) => r.json())
      .then((data) => {
        if (data?.enabled === true) {
          setStoredPushOk(PUSH_CONTEXT_KEYS.business())
          setDone(true)
        }
      })
      .catch(() => {})
  }, [])

  const pushAvailable = typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()
  if (!pushAvailable) return null
  if (done) return null
  const show = checked && (remindAt == null || Date.now() - remindAt > REMIND_MS)
  if (!show) return null

  const remindLater = () => {
    const now = Date.now()
    try {
      localStorage.setItem(REMIND_LATER_KEY, String(now))
    } catch {}
    setRemindAt(now)
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-600/60 bg-amber-950/40 p-4">
      <p className="text-sm font-medium text-amber-200 mb-2">
        {t('Get push notifications when any of your businesses receives a new order.', 'استقبل إشعارات عند وصول طلب جديد لأي من متاجرك.')}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="default"
          disabled={loading}
          className="min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          onClick={() => subscribe()}
        >
          <Bell className="mr-1.5 size-4 shrink-0" />
          {loading ? t('Enabling…', 'جاري التفعيل…') : t('Enable notifications', 'تفعيل الإشعارات')}
        </Button>
        <Button type="button" variant="outline" size="default" className="min-h-[44px] border-amber-500/60 text-amber-200 hover:bg-amber-900/40" onClick={remindLater}>
          {t('Remind me later', 'ذكرني لاحقاً')}
        </Button>
      </div>
    </div>
  )
}
