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
import { useToast } from '@/components/ui/ToastProvider'
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

type TenantPushContextValue = {
  hasPush: boolean
  checked: boolean
  loading: boolean
  permission: NotificationPermission | null
  isDenied: boolean
  needsIOSHomeScreen: boolean
  subscribe: (silent?: boolean) => Promise<boolean>
  /** Force a fresh FCM token to be fetched and registered, even if already subscribed. */
  refreshToken: () => Promise<boolean>
}

const TenantPushContext = createContext<TenantPushContextValue | null>(null)

export function useTenantPush(): TenantPushContextValue {
  const ctx = useContext(TenantPushContext)
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
    }
  }
  return ctx
}

export function TenantPushProvider({ slug, scope: scopeProp, children }: { slug: string; scope?: string; children: ReactNode }) {
  // No trailing slash: scope must exactly match the page URL /t/[slug]/orders so the SW controls it (required for iOS web push).
  const swScope = scopeProp ?? `/t/${slug}/orders`
  const { showToast } = useToast()
  const [hasPush, setHasPush] = useState(false)
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const autoSubscribeRef = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof Notification !== 'undefined')
      setPermission(Notification.permission)
  }, [])

  /**
   * On every mount, verify push status against the live API.
   * localStorage is used only for instant initial render (no gate flicker).
   * If the API disagrees with localStorage (stale token was pruned server-side),
   * we clear the cache and trigger a silent re-subscribe.
   */
  useEffect(() => {
    if (!slug) return
    const contextKey = PUSH_CONTEXT_KEYS.tenant(slug)
    const perm = typeof Notification !== 'undefined' ? Notification.permission : null

    if (perm === 'denied') {
      clearStoredPushOk(contextKey)
      setHasPush(false)
      setChecked(true)
      return
    }

    // Show optimistic state immediately so the page renders without a flicker
    const localOk = perm === 'granted' && getStoredPushOk(contextKey)
    if (localOk) {
      setHasPush(true)
      setChecked(true)
      // Fall through to always verify with API in background
    }

    let cancelled = false
    fetch(`/api/tenants/${slug}/push-subscription`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const apiSaysHasPush = data?.hasPush === true
        if (apiSaysHasPush) {
          setStoredPushOk(contextKey)
          setHasPush(true)
          
          // Auto-heal: If they have a legacy token but lack a central token, silently refresh
          if (data?.needsRefresh && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            if (!autoSubscribeRef.current) {
              autoSubscribeRef.current = true
              subscribe(true).catch(() => {})
            }
          }
        } else {
          // Server has no token (pruned stale, never subscribed, or scope changed).
          // Clear the local cache so the gate / auto-resubscribe can kick in.
          clearStoredPushOk(contextKey)
          setHasPush(false)
        }
        setChecked(true)
      })
      .catch(() => {
        if (!cancelled) setChecked(true)
      })
    return () => { cancelled = true }
  }, [slug])

  const subscribe = useCallback(async (silent = false): Promise<boolean> => {
    if (typeof window === 'undefined' || !slug) return false
    if (isIOS() && !isStandalone()) {
      if (!silent) showToast(
        'On iPhone: add this app to Home Screen first, then open it and tap Enable.',
        'على iPhone: أضف التطبيق إلى الشاشة الرئيسية ثم افتحه واضغط تفعيل.',
        'info'
      )
      return false
    }
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      if (!silent) showToast('Push notifications are not supported in this browser.', 'الإشعارات غير مدعومة في هذا المتصفح.', 'error')
      return false
    }
    const useFCM = typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()
    if (!useFCM && !VAPID_PUBLIC) {
      if (!silent) showToast('Push notifications are not configured. Please contact support.', 'الإشعارات غير مُعدّة. تواصل مع الدعم.', 'error')
      return false
    }
    setLoading(true)
    try {
      // scriptPath: /t/slug/orders/sw.js  scope: /t/slug/orders
      const scriptPath = swScope.endsWith('/')
        ? `${swScope.replace(/\/$/, '')}/sw.js`
        : `${swScope}/sw.js`
      const scope = swScope
      await navigator.serviceWorker.register(scriptPath, { scope })
      await navigator.serviceWorker.ready
      const reg = await navigator.serviceWorker.getRegistration(scope)
      if (!reg) throw new Error('Service worker not active')
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        if (!silent) showToast(
          'Notifications blocked. Enable them in your device settings to get new order alerts.',
          'تم رفض الإشعارات. فعّلها من إعدادات الجهاز لاستقبال الطلبات.',
          'info'
        )
        return false
      }
      if (useFCM) {
        const { token, error: fcmError } = await getFCMToken(reg)
        if (token) {
          const apiUrl = `/api/tenants/${slug}/push-subscription`
          const payload: { fcmToken: string; endpoint?: string; keys?: { p256dh: string; auth: string } } = { fcmToken: token }
          if (VAPID_PUBLIC) {
            try {
              const sub = await reg.pushManager.subscribe({
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
            } catch (_) {}
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
          setStoredPushOk(PUSH_CONTEXT_KEYS.tenant(slug))
          setHasPush(true)
          if (!silent) showToast(
            'Push notifications enabled. You will get an alert when you receive a new order, even if the app is closed.',
            'تم تفعيل الإشعارات. ستستقبل تنبيهاً عند وصول طلب جديد حتى لو كان التطبيق مغلقاً.',
            'success'
          )
          return true
        }
        if (VAPID_PUBLIC) {
          try {
            const sub = await reg.pushManager.subscribe({
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
            if (res.ok) {
              setStoredPushOk(PUSH_CONTEXT_KEYS.tenant(slug))
              setHasPush(true)
              if (!silent) showToast(
                'Push notifications enabled. You will get an alert when you receive a new order.',
                'تم تفعيل الإشعارات. ستستقبل تنبيهاً عند وصول طلب جديد.',
                'success'
              )
              return true
            }
          } catch (_) {}
        }
        throw new Error(fcmError ?? 'Could not get FCM token')
      }
      if (!VAPID_PUBLIC) throw new Error('Push not configured')
      const sub = await reg.pushManager.subscribe({
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
      setHasPush(true)
      if (!silent) showToast(
        'Push notifications enabled. You will get an alert when you receive a new order.',
        'تم تفعيل الإشعارات. ستستقبل تنبيهاً عند وصول طلب جديد.',
        'success'
      )
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to enable'
      if (typeof console !== 'undefined') console.error('[Tenant Push]', e)
      if (!silent) {
        if (isIOS()) {
          showToast(
            'On iPhone: add this app to Home Screen first, then tap Enable again.',
            'على iPhone: أضف التطبيق إلى الشاشة الرئيسية أولاً، ثم اضغط تفعيل مرة أخرى.',
            'info'
          )
        } else {
          showToast(msg, `فشل التفعيل. ${msg}`, 'error')
        }
      }
      return false
    } finally {
      setLoading(false)
    }
  }, [slug, swScope, showToast])

  /**
   * Auto re-subscribe (silent):
   * - When API says no push (hasPush=false) but permission is already granted.
   * - Covers both first-time visits and stale-token recovery after server-side cleanup.
   */
  useEffect(() => {
    if (!slug || !checked || hasPush || loading) return
    if (autoSubscribeRef.current) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    autoSubscribeRef.current = true
    subscribe(true).catch(() => {})
  }, [slug, checked, hasPush, loading, subscribe])

  /**
   * Force a fresh FCM token — call this manually when the user suspects their
   * notifications stopped working. Resets autoSubscribeRef so subscribe() runs fresh.
   */
  const refreshToken = useCallback(async (): Promise<boolean> => {
    autoSubscribeRef.current = false
    return subscribe(false)
  }, [subscribe])

  const value: TenantPushContextValue = {
    hasPush,
    checked,
    loading,
    permission,
    isDenied: permission === 'denied',
    needsIOSHomeScreen: typeof window !== 'undefined' && isIOS() && !isStandalone(),
    subscribe,
    refreshToken,
  }

  return (
    <TenantPushContext.Provider value={value}>
      {children}
    </TenantPushContext.Provider>
  )
}
