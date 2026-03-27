'use client'

/**
 * CRITICAL: Push notifications for new orders (business).
 * Uses FCM when Firebase is configured (same as driver – works when app is closed). Otherwise Web Push (VAPID).
 * Auto-registers FCM when permission is already granted so businesses get push without extra click.
 * When inside TenantPushProvider (manage layout), reuses its single GET to avoid duplicate push-subscription requests.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { Button } from '@/components/ui/button'
import { Bell, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { getTenantPushSubscriptionToken } from '@/lib/tenant-push-subscribe'
import { isFirebaseConfigured } from '@/lib/firebase-config'
import { useTenantPush } from '@/app/(main)/t/[slug]/manage/TenantPushContext'
import { getStoredPushOk, setStoredPushOk, clearStoredPushOk, PUSH_CONTEXT_KEYS } from '@/lib/push-storage'

const VAPID_PUBLIC = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY : undefined

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(base64.replace(/-/g, '+').replace(/_/g, '/') + padding)
  const buf = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

const REMIND_LATER_KEY_PREFIX = 'tenantPushRemindLater_'
const REMIND_LATER_MS = 24 * 60 * 60 * 1000 // 24 hours — ask again at least once per day when disabled

/** Enables push notifications for new orders. Asks at least once per day when disabled; on next visit after disabling we ask again. */
export function TenantPushSetup({ slug, scope }: { slug: string; scope?: string }) {
  const { showToast } = useToast()
  const pushContext = useTenantPush()
  const [done, setDone] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)
  const [remindLaterAt, setRemindLaterAt] = useState<number | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // When inside TenantPushProvider, reuse its single GET so we don't double-request push-subscription
  useEffect(() => {
    if (pushContext.checked) {
      setDone(pushContext.hasPush)
      setChecked(true)
      if (pushContext.permission != null) setPermission(pushContext.permission)
    }
  }, [pushContext.checked, pushContext.hasPush, pushContext.permission])

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof Notification !== 'undefined')
      setPermission(Notification.permission)
  }, [])

  useEffect(() => {
    if (!slug || typeof window === 'undefined') return
    const raw = localStorage.getItem(REMIND_LATER_KEY_PREFIX + slug)
    const t = raw ? parseInt(raw, 10) : NaN
    setRemindLaterAt(Number.isFinite(t) ? t : null)
  }, [slug])

  const autoRegisteredRef = useRef(false)

  useEffect(() => {
    if (!slug) return
    if (pushContext.checked) return
    const contextKey = PUSH_CONTEXT_KEYS.tenant(slug)
    const perm = typeof window !== 'undefined' && typeof Notification !== 'undefined' ? Notification.permission : null
    if (perm === 'denied') {
      clearStoredPushOk(contextKey)
      setChecked(true)
      return
    }
    if (perm === 'granted' && getStoredPushOk(contextKey)) {
      setDone(true)
      setChecked(true)
      return
    }
    fetch(`/api/tenants/${slug}/push-subscription`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data?.hasPush === true) {
          setStoredPushOk(contextKey)
          setDone(true)
          try {
            localStorage.removeItem(REMIND_LATER_KEY_PREFIX + slug)
          } catch (_) {}
        }
        setChecked(true)
      })
      .catch(() => setChecked(true))
  }, [slug, pushContext.checked])

  // When scope is provided (per-business), use tenant-scoped SW and per-tenant API. When no scope (dashboard only), unified is handled by BusinessPushSetup.
  useEffect(() => {
    if (!slug || !scope || autoRegisteredRef.current || typeof window === 'undefined') return
    if (!checked || done) return
    const useFCM = typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()
    const isNativeCheck = typeof window !== 'undefined' && Capacitor.isNativePlatform()
    if (!useFCM || (!isNativeCheck && Notification.permission !== 'granted')) return
    if (!isNativeCheck && !('serviceWorker' in navigator)) return

    let cancelled = false
    const scopeForReg = scope || '/dashboard/'
    ;(async () => {
      try {
        const { token } = await getTenantPushSubscriptionToken(false, scopeForReg)
        if (cancelled || !token) return
        const res = await fetch(`/api/tenants/${slug}/push-subscription`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fcmToken: token }),
        })
        if (res.ok) {
          autoRegisteredRef.current = true
          setStoredPushOk(PUSH_CONTEXT_KEYS.tenant(slug))
          setDone(true)
        }
      } catch (_) {
        // Silent; user can still tap Enable
      }
    })()
    return () => { cancelled = true }
  }, [slug, scope, checked, done])

  const subscribe = useCallback(async () => {
    if (typeof window === 'undefined' || !slug) return false
    const isNativeCheck = typeof window !== 'undefined' && Capacitor.isNativePlatform()
    if (isIOS() && !isStandalone() && !isNativeCheck) {
      showToast(
        'On iPhone: add this app to Home Screen first, then open it and tap Enable.',
        'على iPhone: أضف التطبيق إلى الشاشة الرئيسية ثم افتحه واضغط تفعيل.',
        'info'
      )
      return false
    }
    if (!isNativeCheck && (!('serviceWorker' in navigator) || !('Notification' in window))) {
      showToast('Push notifications are not supported in this browser.', 'الإشعارات غير مدعومة في هذا المتصفح.', 'error')
      return false
    }
    const useFCM = typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()
    if (!useFCM && !VAPID_PUBLIC) {
      showToast('Push notifications are not configured. Please contact support.', 'الإشعارات غير مُعدّة. تواصل مع الدعم.', 'error')
      return false
    }
    setLoading(true)
    try {
      // Per-business PWA: when scope is provided (e.g. /t/xxx/manage), use that scope's SW and per-tenant API. Unified (app-sw + business-push-subscription) is only for dashboard via BusinessPushSetup.
      const useUnified = useFCM && !scope
      const swScope = useUnified ? '/' : (scope ?? '/t')
      const scopeForReg = swScope
      
      if (useFCM || isNativeCheck) {
        const { token: fcmToken, permissionState, registration, error: fcmError } = await getTenantPushSubscriptionToken(true, scopeForReg)
        
        if (permissionState === 'denied' && !isNativeCheck) {
           setPermission('denied')
        } else if (permissionState === 'granted') {
           setPermission('granted')
        }

        if (permissionState !== 'granted') {
          showToast(
            'Notifications blocked. Enable them in your device settings to get new order alerts.',
            'تم رفض الإشعارات. فعّلها من إعدادات الجهاز لاستقبال تنبيهات الطلبات.',
            'info'
          )
          return false
        }

        if (fcmToken) {
          const apiUrl = useUnified ? '/api/me/business-push-subscription' : `/api/tenants/${slug}/push-subscription`
          const payload: { fcmToken: string; endpoint?: string; keys?: { p256dh: string; auth: string } } = { fcmToken }
          if (!useUnified && VAPID_PUBLIC && registration) {
            try {
              const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
              })
              const p256 = new Uint8Array(sub.getKey('p256dh')!)
              const auth = new Uint8Array(sub.getKey('auth')!)
              payload.endpoint = sub.endpoint
              payload.keys = {
                p256dh: btoa(String.fromCharCode.apply(null, Array.from(p256))),
                auth: btoa(String.fromCharCode.apply(null, Array.from(auth))),
              }
            } catch (_) {
              // Web Push optional when FCM present; server falls back to FCM
            }
          }
          const res = await fetch(apiUrl, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err?.error || 'Failed to save subscription')
          }
          if (useUnified) setStoredPushOk(PUSH_CONTEXT_KEYS.business())
          else setStoredPushOk(PUSH_CONTEXT_KEYS.tenant(slug))
          setDone(true)
          setRemindLaterAt(null)
          try {
            localStorage.removeItem(REMIND_LATER_KEY_PREFIX + slug)
          } catch (_) {}
          showToast(
            useUnified
              ? 'Push enabled. You’ll get high-priority alerts for new orders from any of your businesses, even when the app is closed.'
              : 'Push notifications enabled. You’ll get an alert when you receive a new order.',
            useUnified
              ? 'تم تفعيل الإشعارات. ستستقبل تنبيهاً عاجلاً عند وصول طلب جديد لأي متجر حتى لو كان التطبيق مغلقاً.'
              : 'تم تفعيل الإشعارات. ستستقبل تنبيهاً عند وصول طلب جديد.',
            'success'
          )
          return true
        }
        
        if (VAPID_PUBLIC && registration) {
          try {
            const sub = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
            })
            const p256 = new Uint8Array(sub.getKey('p256dh')!)
            const auth = new Uint8Array(sub.getKey('auth')!)
            const res = await fetch(`/api/tenants/${slug}/push-subscription`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                endpoint: sub.endpoint,
                keys: {
                  p256dh: btoa(String.fromCharCode.apply(null, Array.from(p256))),
                  auth: btoa(String.fromCharCode.apply(null, Array.from(auth))),
                },
              }),
            })
            if (!res.ok) {
              const err = await res.json().catch(() => ({}))
              throw new Error(err?.error || 'Failed to save subscription')
            }
            setStoredPushOk(PUSH_CONTEXT_KEYS.tenant(slug))
            setDone(true)
            setRemindLaterAt(null)
            try {
              localStorage.removeItem(REMIND_LATER_KEY_PREFIX + slug)
            } catch (_) {}
            showToast(
              'Push notifications enabled. You’ll get an alert when you receive a new order.',
              'تم تفعيل الإشعارات. ستستقبل تنبيهاً عند وصول طلب جديد.',
              'success'
            )
            return true
          } catch (_) {}
        }
        
        throw new Error(fcmError ?? 'Could not get FCM token')
      }

      if (!VAPID_PUBLIC) {
        throw new Error('Push not configured')
      }
      
      const swScript = scope ? `${scope.replace(/\/$/, '')}/sw.js` : `/t/${slug}/orders/sw.js`
      const registration = await navigator.serviceWorker.register(swScript, { scope: scopeForReg })
      await (registration as unknown as { ready: Promise<ServiceWorkerRegistration> }).ready
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        showToast(
          'Notifications blocked. Enable them in your device settings to get new order alerts.',
          'تم رفض الإشعارات. فعّلها من إعدادات الجهاز لاستقبال تنبيهات الطلبات.',
          'info'
        )
        return false
      }
      
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
      })
      const p256 = new Uint8Array(sub.getKey('p256dh')!)
      const auth = new Uint8Array(sub.getKey('auth')!)
      const res = await fetch(`/api/tenants/${slug}/push-subscription`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode.apply(null, Array.from(p256))),
            auth: btoa(String.fromCharCode.apply(null, Array.from(auth))),
          },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to save subscription')
      }
      setStoredPushOk(PUSH_CONTEXT_KEYS.tenant(slug))
      setDone(true)
      setRemindLaterAt(null)
      try {
        localStorage.removeItem(REMIND_LATER_KEY_PREFIX + slug)
      } catch (_) {}
      showToast(
        'Push notifications enabled. You’ll get an alert when you receive a new order.',
        'تم تفعيل الإشعارات. ستستقبل تنبيهاً عند وصول طلب جديد.',
        'success'
      )
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to enable'
      if (typeof console !== 'undefined') console.error('[Tenant Push]', e)
      if (isIOS()) {
        showToast(
          'On iPhone: add this app to Home Screen first, then tap Enable again.',
          'على iPhone: أضف التطبيق إلى الشاشة الرئيسية أولاً، ثم اضغط تفعيل مرة أخرى.',
          'info'
        )
      } else {
        showToast(msg, `فشل التفعيل. ${msg}`, 'error')
      }
      return false
    } finally {
      setLoading(false)
    }
  }, [slug, scope, showToast])

  // Don't show the banner if neither FCM nor VAPID is configured (avoids "contact support" error on click)
  const pushAvailable = (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()) || !!VAPID_PUBLIC
  if (!pushAvailable) return null

  // ── When push IS already enabled, show a subtle "active" indicator + manual refresh ──
  if (done && checked) {
    const handleRefresh = async () => {
      setIsRefreshing(true)
      try {
        const ok = await pushContext.refreshToken()
        if (ok) {
          showToast(
            'Notifications refreshed. Your device is now receiving fresh alerts.',
            'تم تحديث الإشعارات. جهازك يستقبل التنبيهات الآن.',
            'success'
          )
        } else {
          showToast(
            'Could not refresh notifications. Try tapping "Enable" from the settings.',
            'تعذّر تحديث الإشعارات. حاول النقر على «تفعيل» من الإعدادات.',
            'error'
          )
        }
      } finally {
        setIsRefreshing(false)
      }
    }

    return (
      <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
          <span className="text-sm text-emerald-300 truncate">
            الإشعارات مفعّلة
            <span className="hidden sm:inline text-emerald-400/70"> — Notifications active</span>
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isRefreshing}
          onClick={handleRefresh}
          className="shrink-0 h-8 px-2 text-xs text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-900/40"
          title="Refresh FCM token / تحديث رمز الإشعارات"
        >
          <RefreshCw className={`size-3.5 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'جاري التحديث…' : 'تحديث'}
        </Button>
      </div>
    )
  }

  // Show when push is not enabled and either we never reminded later, or 24h have passed (ask at least once per day)
  const remindLaterStillActive = remindLaterAt != null && Date.now() - remindLaterAt < REMIND_LATER_MS
  const showHint = !done && checked && !remindLaterStillActive

  if (!showHint) return null

  const isDenied = permission === 'denied'
  const needsIOSHomeScreen = typeof window !== 'undefined' && isIOS() && !isStandalone()

  const remindMeLater = () => {
    const now = Date.now()
    try {
      localStorage.setItem(REMIND_LATER_KEY_PREFIX + slug, String(now))
    } catch (_) {}
    setRemindLaterAt(now)
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-600/60 bg-amber-950/40 p-4">
      {needsIOSHomeScreen ? (
        <p className="text-sm text-amber-200/90 mb-2">
          On iPhone, push notifications only work when the app is opened from the Home Screen. Add this page to your Home Screen (Share → Add to Home Screen), then open the app from your home screen and tap Enable below.
        </p>
      ) : (
        <p className="text-sm font-medium text-amber-200 mb-2">
          {isDenied
            ? 'To get new order alerts when you’re not on this page: enable notifications in your browser settings, then refresh and tap Enable.'
            : 'Get push notifications when you receive a new order, even if you’re not on the Orders page. We’ll ask again on your next visit if it’s disabled.'}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="default"
          disabled={loading || (isDenied && !needsIOSHomeScreen)}
          className="min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          onClick={() => subscribe()}
        >
          <Bell className="mr-1.5 size-4 shrink-0" />
          {needsIOSHomeScreen ? 'Add to Home Screen first' : (loading ? 'Enabling…' : 'Enable push notifications')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="default"
          className="min-h-[44px] border-amber-500/60 text-amber-200 hover:bg-amber-900/40"
          onClick={remindMeLater}
        >
          Remind me later
        </Button>
        {isDenied && (
          <span className="text-xs text-amber-300/80">
            Browser settings → Notifications → Allow for this site
          </span>
        )}
      </div>
    </div>
  )
}
