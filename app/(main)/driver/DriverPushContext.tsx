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
import { getDriverPushSubscriptionToken } from '@/lib/driver-push-subscribe'
import { isFirebaseConfigured } from '@/lib/firebase-config'
import { getStoredPushOk, setStoredPushOk, clearStoredPushOk, PUSH_CONTEXT_KEYS } from '@/lib/push-storage'
import { getDeviceGeolocationPosition, isDeviceGeolocationSupported, checkDeviceGeolocationPermission } from '@/lib/device-geolocation'
import { Capacitor } from '@capacitor/core'

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
  const [needsPushRefresh, setNeedsPushRefresh] = useState(false)
  const mountedAt = useRef<number>(Date.now())
  const minShowMs = 2500

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof Notification !== 'undefined')
      setPermission(Notification.permission)
  }, [])

  const getCurrentDriverToken = useCallback(async (): Promise<string> => {
    if (typeof window === 'undefined') return ''
    const useFCM = typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()
    if (!useFCM) return ''
    try {
      const { token } = await getDriverPushSubscriptionToken(false)
      return token ?? ''
    } catch {
      return ''
    }
  }, [])

  // Check location permission on mount. Samsung/Android may not support Permissions API; use probe when uncertain.
  useEffect(() => {
    if (!isDeviceGeolocationSupported()) {
      setLocationChecked(true)
      return
    }
    checkDeviceGeolocationPermission().then((state) => {
      if (state === 'granted') {
        setHasLocation(true)
        setLocationChecked(true)
      } else if (state === 'denied') {
        setHasLocation(false)
        setLocationChecked(true)
      } else {
        // "prompt" – Permissions API can't tell; probe with getDeviceGeolocationPosition (Samsung often reports prompt even when working)
        getDeviceGeolocationPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 })
          .then(() => {
            setHasLocation(true)
            setLocationChecked(true)
          })
          .catch(() => {
            setHasLocation(false)
            setLocationChecked(true)
          })
      }
    }).catch(() => setLocationChecked(true))
  }, [])

  const checkPushHealth = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) return
    const isNativeCheck = typeof window !== 'undefined' && Capacitor.isNativePlatform()
    
    // Asynchronously check *actual* OS permission before trusting cache
    let currentPerm = typeof Notification !== 'undefined' ? Notification.permission : null
    if (isNativeCheck) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        const permStatus = await PushNotifications.checkPermissions()
        currentPerm = permStatus.receive === 'granted' ? 'granted' : 'denied'
      } catch (e) {
        // Fallback
      }
    }
    
    if (!isNativeCheck && currentPerm === 'denied') {
      clearStoredPushOk(PUSH_CONTEXT_KEYS.driver())
      setHasPush(false)
      setChecked(true)
      return
    }
    if ((isNativeCheck || currentPerm === 'granted') && getStoredPushOk(PUSH_CONTEXT_KEYS.driver())) {
      setHasPush(true)
      // still continue health check in background
    }
    const currentToken = await getCurrentDriverToken()
    const tokenQuery = currentToken ? `?token=${encodeURIComponent(currentToken)}` : ''
    try {
      const r = await fetch(`/api/driver/push-subscription${tokenQuery}`)
      const data = await r.json()
      const apiSaysHasPush = data?.hasPush === true
      if (apiSaysHasPush) {
        setStoredPushOk(PUSH_CONTEXT_KEYS.driver())
        const elapsed = Date.now() - mountedAt.current
        if (elapsed >= minShowMs) {
          setHasPush(true)
        } else {
          const remaining = minShowMs - elapsed
          setTimeout(() => setHasPush(true), remaining)
        }
      } else {
        clearStoredPushOk(PUSH_CONTEXT_KEYS.driver())
        setHasPush(false)
      }
      if (data?.needsRefresh && (isNativeCheck || currentPerm === 'granted')) setNeedsPushRefresh(true)
    } catch {
      // ignore temporary failures
    } finally {
      setChecked(true)
    }
  }, [getCurrentDriverToken])

  useEffect(() => {
    checkPushHealth().catch(() => {})
  }, [checkPushHealth])

  useEffect(() => {
    const isNativeCheck = typeof window !== 'undefined' && Capacitor.isNativePlatform()
    if (!checked || (!isNativeCheck && permission !== 'granted')) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        checkPushHealth().catch(() => {})
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible)
    }
    const timer = setInterval(() => {
      checkPushHealth().catch(() => {})
    }, 10 * 60 * 1000)
    return () => {
      clearInterval(timer)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible)
      }
    }
  }, [checked, permission, checkPushHealth])

  // Welcome ping with local throttle (2h); server enforces 24h. Confirms push works when driver returns to app.
  const WELCOME_LAST_PING_KEY = 'bedi-driver-welcome-last-ping'
  useEffect(() => {
    if (typeof window === 'undefined' || !hasPush) return
    try {
      const last = Number(localStorage.getItem(WELCOME_LAST_PING_KEY) || '0')
      if (Number.isFinite(last) && Date.now() - last < 2 * 60 * 60 * 1000) return
      localStorage.setItem(WELCOME_LAST_PING_KEY, String(Date.now()))
      fetch('/api/driver/push-send-welcome', { method: 'POST' }).catch(() => {})
    } catch {
      // storage can throw in private mode
    }
  }, [hasPush])

  const subscribe = useCallback(async (opts?: { isRefresh?: boolean }): Promise<boolean> => {
    const isRefresh = opts?.isRefresh === true
    if (typeof window === 'undefined') return false
    // On iOS, Web Push only works when the app is opened from Home Screen (PWA), not in Safari tab.
    if (isIOS() && !isStandalone() && !Capacitor.isNativePlatform()) {
      showToast(
        'On iPhone: add this app to Home Screen first, then open it and tap Enable.',
        'على iPhone: أضف التطبيق إلى الشاشة الرئيسية ثم افتحه واضغط تفعيل.',
        'info'
      )
      return false
    }
    const isNativeCheck = typeof window !== 'undefined' && Capacitor.isNativePlatform()
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
      if (useFCM || isNativeCheck) {
        const { token, permissionState, registration, error: fcmError } = await getDriverPushSubscriptionToken(true)
        if (permissionState === 'denied' && !isNativeCheck) {
           setPermission('denied')
        } else if (permissionState === 'granted') {
           setPermission('granted')
        }

        if (permissionState !== 'granted') {
          showToast(
            'Notifications blocked. Enable them in your device settings to get new order alerts.',
            'تم رفض الإشعارات. فعّلها من إعدادات الجهاز لاستقبال الطلبات.',
            'info'
          )
          return false
        }

        if (token) {
          const pushClient = Capacitor.isNativePlatform() ? 'native' : (isStandalone() ? 'pwa' : 'browser')
          const payload: { fcmToken: string; endpoint?: string; keys?: { p256dh: string; auth: string }; forceConfirmation?: boolean; pushClient: string } = { fcmToken: token, pushClient }
          if (isRefresh) payload.forceConfirmation = true
          if (VAPID_PUBLIC && registration) {
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
          if (!isRefresh) {
            showToast('Push notifications enabled. You will get new order alerts.', 'تم تفعيل الإشعارات. ستستقبل تنبيهات الطلبات الجديدة.', 'success')
          }
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
            const pushClient = Capacitor.isNativePlatform() ? 'native' : (isStandalone() ? 'pwa' : 'browser')
            const webPushBody: Record<string, unknown> = {
              endpoint: sub.endpoint,
              keys: {
                p256dh: btoa(String.fromCharCode.apply(null, Array.from(p256))),
                auth: btoa(String.fromCharCode.apply(null, Array.from(auth))),
              },
              pushClient,
            }
            if (isRefresh) webPushBody.forceConfirmation = true
            const res = await fetch('/api/driver/push-subscription', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(webPushBody),
            })
            if (res.status === 404) {
              showToast('Complete your profile first to get notifications.', 'أكمل ملفك الشخصي أولاً لاستقبال الإشعارات.', 'error')
              router.replace('/driver/profile')
              return false
            }
            if (res.ok) {
              setStoredPushOk(PUSH_CONTEXT_KEYS.driver())
              setHasPush(true)
              if (!isRefresh) {
                showToast('Push notifications enabled. You will get new order alerts.', 'تم تفعيل الإشعارات. ستستقبل تنبيهات الطلبات الجديدة.', 'success')
              }
              return true
            }
          } catch (_) {
            // fallback failed
          }
        }
        throw new Error(fcmError ?? 'Could not get FCM token')
      }

      // VAPID fallback path (only applies if web without FCM, and requires SW)
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
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC!) as BufferSource,
      })
      const p256 = new Uint8Array(sub.getKey('p256dh')!)
      const auth = new Uint8Array(sub.getKey('auth')!)
      const pushClient = Capacitor.isNativePlatform() ? 'native' : (isStandalone() ? 'pwa' : 'browser')
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
          pushClient,
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
    const ok = await subscribe({ isRefresh: true })
    if (!ok) {
      showToast('تعذّر تحديث الإشعارات. حاول مرة أخرى.', undefined, 'error')
    }
    return ok
  }, [subscribe, showToast])

  useEffect(() => {
    if (!needsPushRefresh || permission !== 'granted') return
    setNeedsPushRefresh(false)
    refreshToken().catch(() => {})
  }, [needsPushRefresh, permission, refreshToken])

  const requestLocation = useCallback(async (): Promise<boolean> => {
    if (!isDeviceGeolocationSupported()) {
      showToast('Location is not supported.', 'الموقع غير مدعوم.', 'error')
      return false
    }
    const isSamsung = /samsung|android/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '')
    // Samsung/Android: use longer timeout (25s), try high accuracy first, fallback to battery-saving
    const highAccuracyOptions = {
      enableHighAccuracy: true,
      timeout: isSamsung ? 25000 : 15000,
      maximumAge: 0,
    }
    const fallbackOptions = {
      enableHighAccuracy: false,
      timeout: isSamsung ? 25000 : 15000,
      maximumAge: 60000,
    }
    setLocationLoading(true)
    try {
      const tryGetPosition = (opts: typeof highAccuracyOptions) => getDeviceGeolocationPosition(opts)
        
      let position: { latitude: number; longitude: number; accuracy?: number | null }
      try {
        position = await tryGetPosition(highAccuracyOptions)
      } catch (firstErr) {
        if (isSamsung) {
          try {
            position = await tryGetPosition(fallbackOptions)
          } catch {
            throw firstErr
          }
        } else {
          throw firstErr
        }
      }
      setHasLocation(true)

      fetch('/api/driver/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: position.latitude,
          lng: position.longitude,
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
          'Location denied. Enable it in device settings: Settings → Apps → Bedi Driver → Permissions → Location.',
          'تم رفض الموقع. فعّله من إعدادات الجهاز: الإعدادات ← التطبيقات ← Bedi Driver ← الأذونات ← الموقع.',
          'info'
        )
      } else {
        showToast(
          isSamsung
            ? 'Could not get location. On Samsung: enable Location, wait 10–20 sec, try again. Or check Settings → Apps → Permissions.'
            : 'Could not get location. Enable location in settings and try again.',
          isSamsung
            ? 'تعذر الحصول على الموقع. على Samsung: فعّل الموقع، انتظر 10–20 ثانية، جرّب مجدداً. أو راجع الإعدادات ← التطبيقات ← الأذونات.'
            : 'تعذر الحصول على الموقع. فعّل الموقع من الإعدادات وحاول مرة أخرى.',
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
