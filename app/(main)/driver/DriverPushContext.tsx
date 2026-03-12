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
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/ToastProvider'
import { useLanguage } from '@/components/LanguageContext'
import { getFCMToken } from '@/lib/firebase'
import { isFirebaseConfigured } from '@/lib/firebase-config'
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

type DriverPushContextValue = {
  hasPush: boolean
  checked: boolean
  loading: boolean
  permission: NotificationPermission | null
  isDenied: boolean
  /** True when on iOS and not launched from Home Screen (PWA). Push only works after Add to Home Screen. */
  needsIOSHomeScreen: boolean
  subscribe: () => Promise<boolean>
  /** Force a fresh FCM token fetch and re-register with the server. */
  refreshToken: () => Promise<boolean>
  /** Location permission granted (required for driver; used later for map). */
  hasLocation: boolean
  locationChecked: boolean
  locationLoading: boolean
  requestLocation: () => Promise<boolean>
}

const DriverPushContext = createContext<DriverPushContextValue | null>(null)

export function useDriverPush(): DriverPushContextValue {
  const ctx = useContext(DriverPushContext)
  if (!ctx) {
    return {
      hasPush: false,
      checked: false,
      loading: false,
      permission: null,
      isDenied: false,
      needsIOSHomeScreen: false,
      subscribe: async () => false,
      refreshToken: async () => false,
      hasLocation: false,
      locationChecked: false,
      locationLoading: false,
      requestLocation: async () => false,
    }
  }
  return ctx
}

export function DriverPushProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast()
  const router = useRouter()
  const { t } = useLanguage()
  const [hasPush, setHasPush] = useState(false)
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [hasLocation, setHasLocation] = useState(false)
  const [locationChecked, setLocationChecked] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const mountedAt = useRef<number>(Date.now())
  const minShowMs = 2500

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof Notification !== 'undefined')
      setPermission(Notification.permission)
  }, [])

  // Check location permission on mount (no prompt). Only set hasLocation when already granted.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationChecked(true)
      return
    }
    const check = () => {
      if ('permissions' in navigator && typeof (navigator as { permissions?: { query: (p: { name: string }) => Promise<{ state: string }> } }).permissions?.query === 'function') {
        ;(navigator as { permissions: { query: (p: { name: string }) => Promise<{ state: string }> } }).permissions
          .query({ name: 'geolocation' })
          .then((result) => {
            setHasLocation(result.state === 'granted')
            setLocationChecked(true)
          })
          .catch(() => setLocationChecked(true))
      } else {
        setLocationChecked(true)
      }
    }
    check()
  }, [])

  useEffect(() => {
    const perm = typeof Notification !== 'undefined' ? Notification.permission : null
    if (perm === 'denied') {
      clearStoredPushOk(PUSH_CONTEXT_KEYS.driver())
      setHasPush(false)
      setChecked(true)
      return
    }
    if (perm === 'granted' && getStoredPushOk(PUSH_CONTEXT_KEYS.driver())) {
      setHasPush(true)
      setChecked(true)
      return
    }
    let cancelled = false
    fetch('/api/driver/push-subscription')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const apiSaysHasPush = data?.hasPush === true
        if (apiSaysHasPush) {
          setStoredPushOk(PUSH_CONTEXT_KEYS.driver())
          const elapsed = Date.now() - mountedAt.current
          if (elapsed >= minShowMs) {
            setHasPush(true)
          } else {
            const remaining = minShowMs - elapsed
            setTimeout(() => {
              if (!cancelled) setHasPush(true)
            }, remaining)
          }
        } else {
          clearStoredPushOk(PUSH_CONTEXT_KEYS.driver())
          setHasPush(false)
        }
        setChecked(true)
      })
      .catch(() => { setChecked(true) })
    return () => { cancelled = true }
  }, [])

  // When driver opens PWA and already has push, send welcome once per session (so they get it every time they open the app).
  const WELCOME_SENT_KEY = 'bedi-driver-welcome-sent'
  useEffect(() => {
    if (typeof window === 'undefined' || !hasPush) return
    try {
      if (sessionStorage.getItem(WELCOME_SENT_KEY)) return
      sessionStorage.setItem(WELCOME_SENT_KEY, '1')
      fetch('/api/driver/push-send-welcome', { method: 'POST' }).catch(() => {})
    } catch {
      // sessionStorage can throw in private mode
    }
  }, [hasPush])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false
    // On iOS, Web Push only works when the app is opened from Home Screen (PWA), not in Safari tab.
    if (isIOS() && !isStandalone()) {
      showToast(
        'On iPhone: add this app to Home Screen first, then open it and tap Enable.',
        'على iPhone: أضف التطبيق إلى الشاشة الرئيسية ثم افتحه واضغط تفعيل.',
        'info'
      )
      return false
    }
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
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
      // Register driver SW directly; Chrome rejects redirected SW script URLs.
      const registration = await navigator.serviceWorker.register('/driver-sw.js', { scope: '/driver/' })
      await (registration as unknown as { ready: Promise<ServiceWorkerRegistration> }).ready
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        showToast(
          'Notifications blocked. Enable them in your device settings to get new order alerts.',
          'تم رفض الإشعارات. فعّلها من إعدادات الجهاز لاستقبال الطلبات.',
          'info'
        )
        return false
      }
      if (useFCM) {
        const { token, error: fcmError } = await getFCMToken(registration)
        if (token) {
          const payload: { fcmToken: string; endpoint?: string; keys?: { p256dh: string; auth: string } } = { fcmToken: token }
          if (VAPID_PUBLIC) {
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
              // Web Push optional when FCM present; server can still use FCM or fall back later
            }
          }
          const res = await fetch('/api/driver/push-subscription', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (res.status === 404) {
            showToast('Complete your profile first to get notifications.', 'أكمل ملفك الشخصي أولاً لاستقبال الإشعارات.', 'error')
            router.replace('/driver/profile')
            return false
          }
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err?.error || 'Failed to save subscription')
          }
          setStoredPushOk(PUSH_CONTEXT_KEYS.driver())
          setHasPush(true)
          showToast('Push notifications enabled. You will get new order alerts.', 'تم تفعيل الإشعارات. ستستقبل تنبيهات الطلبات الجديدة.', 'success')
          try {
            sessionStorage.setItem('bedi-driver-welcome-sent', '1')
          } catch {}
          // Delay so Sanity write is visible before push-send-welcome reads the token.
          setTimeout(() => fetch('/api/driver/push-send-welcome', { method: 'POST' }).catch(() => {}), 1000)
          return true
        }
        if (VAPID_PUBLIC) {
          try {
            const sub = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
            })
            const p256 = new Uint8Array(sub.getKey('p256dh')!)
            const auth = new Uint8Array(sub.getKey('auth')!)
            const res = await fetch('/api/driver/push-subscription', {
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
            if (res.status === 404) {
              showToast('Complete your profile first to get notifications.', 'أكمل ملفك الشخصي أولاً لاستقبال الإشعارات.', 'error')
              router.replace('/driver/profile')
              return false
            }
            if (res.ok) {
              setStoredPushOk(PUSH_CONTEXT_KEYS.driver())
              setHasPush(true)
              showToast('Push notifications enabled. You will get new order alerts.', 'تم تفعيل الإشعارات. ستستقبل تنبيهات الطلبات الجديدة.', 'success')
              try {
                sessionStorage.setItem('bedi-driver-welcome-sent', '1')
              } catch {}
              setTimeout(() => fetch('/api/driver/push-send-welcome', { method: 'POST' }).catch(() => {}), 1000)
              return true
            }
          } catch (_) {
            // fallback failed
          }
        }
        throw new Error(fcmError ?? 'Could not get FCM token')
      }
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC!) as BufferSource,
      })
      const p256 = new Uint8Array(sub.getKey('p256dh')!)
      const auth = new Uint8Array(sub.getKey('auth')!)
      const res = await fetch('/api/driver/push-subscription', {
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
      if (res.status === 404) {
        showToast('Complete your profile first to get notifications.', 'أكمل ملفك الشخصي أولاً لاستقبال الإشعارات.', 'error')
        router.replace('/driver/profile')
        return false
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to save subscription')
      }
      setStoredPushOk(PUSH_CONTEXT_KEYS.driver())
      setHasPush(true)
      showToast('Push notifications enabled. You will get new order alerts.', 'تم تفعيل الإشعارات. ستستقبل تنبيهات الطلبات الجديدة.', 'success')
      try {
        sessionStorage.setItem('bedi-driver-welcome-sent', '1')
      } catch {}
      setTimeout(() => fetch('/api/driver/push-send-welcome', { method: 'POST' }).catch(() => {}), 1000)
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to enable'
      if (typeof console !== 'undefined') console.error('[Driver Push]', e)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      if (isIOS) {
        showToast(
          'On iPhone: add this app to Home Screen first, then tap Enable again.',
          'على iPhone: أضف التطبيق إلى الشاشة الرئيسية أولاً، ثم اضغط تفعيل مرة أخرى.',
          'info'
        )
      } else {
        showToast(msg, `فشل التفعيل. ${msg} جرّب مرة أخرى أو استخدم Chrome.`, 'error')
      }
      return false
    } finally {
      setLoading(false)
    }
  }, [showToast, router])

  const refreshToken = useCallback(async (): Promise<boolean> => {
    clearStoredPushOk(PUSH_CONTEXT_KEYS.driver())
    setHasPush(false)
    const ok = await subscribe()
    if (ok) {
      showToast('تم تحديث الإشعارات بنجاح.', undefined, 'success')
    } else {
      showToast('تعذّر تحديث الإشعارات. حاول مرة أخرى.', undefined, 'error')
    }
    return ok
  }, [subscribe, showToast])

  const requestLocation = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('Location is not supported.', 'الموقع غير مدعوم.', 'error')
      return false
    }
    setLocationLoading(true)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        )
      })
      setHasLocation(true)

      // Persist coordinates to Sanity via API (fire-and-forget, don't block UX)
      fetch('/api/driver/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      }).catch(() => {})

      showToast(
        t('Location updated. You can receive orders.', 'تم تحديث موقعك. يمكنك استقبال الطلبات.'),
        undefined,
        'success'
      )
      return true
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code: number }).code : 0
      if (code === 1) {
        showToast(
          'Location is required. Enable it in device settings to receive orders and be shown on the map.',
          'الموقع مطلوب. فعّله من إعدادات الجهاز لاستقبال الطلبات والظهور على الخريطة.',
          'info'
        )
      } else {
        showToast(
          'Could not get location. Enable location in settings and try again.',
          'تعذر الحصول على الموقع. فعّل الموقع من الإعدادات وحاول مرة أخرى.',
          'error'
        )
      }
      return false
    } finally {
      setLocationLoading(false)
    }
  }, [showToast, t])

  const value: DriverPushContextValue = {
    hasPush,
    checked,
    loading,
    permission,
    isDenied: permission === 'denied',
    needsIOSHomeScreen: typeof window !== 'undefined' && isIOS() && !isStandalone(),
    subscribe,
    refreshToken,
    hasLocation,
    locationChecked,
    locationLoading,
    requestLocation,
  }

  return (
    <DriverPushContext.Provider value={value}>
      {children}
    </DriverPushContext.Provider>
  )
}
