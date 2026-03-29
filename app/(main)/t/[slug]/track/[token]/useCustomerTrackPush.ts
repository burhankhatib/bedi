'use client'

import { useState, useEffect, useCallback } from 'react'
import { getCustomerPushSubscriptionToken } from '@/lib/customer-push-subscribe'
import { isFirebaseConfigured } from '@/lib/firebase-config'
import { getStoredPushOk, setStoredPushOk, clearStoredPushOk, PUSH_CONTEXT_KEYS } from '@/lib/push-storage'

const VAPID_PUBLIC = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY : undefined

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

export function useCustomerTrackPush(slug: string, token: string) {
  const [hasPush, setHasPush] = useState(false)
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
  const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()
  const needsIOSHomeScreen = isIOS && !isStandalone() && !isNative
  const [lastServerStatus, setLastServerStatus] = useState<'ok' | 'refreshed' | 'not_found' | null>(null)
  const [needsRefresh, setNeedsRefresh] = useState(false)

  const getCurrentFcmToken = useCallback(async (): Promise<string> => {
    if (typeof window === 'undefined') return ''
    const useFCM = typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()
    if (!useFCM) return ''
    try {
      const { token } = await getCustomerPushSubscriptionToken(false)
      return token ?? ''
    } catch {
      return ''
    }
  }, [])

  const checkHasPush = useCallback(async () => {
    if (!slug || !token) return
    const contextKey = PUSH_CONTEXT_KEYS.customer(slug, token)
    const isNativeCheck = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()
    const perm = typeof Notification !== 'undefined' ? Notification.permission : null
    if (!isNativeCheck && perm === 'denied') {
      clearStoredPushOk(contextKey)
      setHasPush(false)
      setChecked(true)
      return
    }
    if ((isNativeCheck || perm === 'granted') && getStoredPushOk(contextKey)) {
      setHasPush(true)
      setChecked(true)
      return
    }
    try {
      const currentToken = await getCurrentFcmToken()
      const tokenQuery = currentToken ? `?token=${encodeURIComponent(currentToken)}` : ''
      const res = await fetch(`/api/tenants/${encodeURIComponent(slug)}/track/${encodeURIComponent(token)}/push-subscription${tokenQuery}`)
      const data = await res.json()
      const ok = data?.hasPush === true
      setLastServerStatus((data?.status as 'ok' | 'refreshed' | 'not_found' | undefined) ?? null)
      if (ok) setStoredPushOk(contextKey)
      else clearStoredPushOk(contextKey)
      setHasPush(ok)
      if (data?.needsRefresh && (isNativeCheck || perm === 'granted')) {
        setNeedsRefresh(true)
      }
    } catch {
      setHasPush(false)
    } finally {
      setChecked(true)
    }
  }, [slug, token, getCurrentFcmToken])

  useEffect(() => {
    checkHasPush()
  }, [checkHasPush])

  const syncPermission = useCallback(() => {
    if (typeof window !== 'undefined' && typeof Notification !== 'undefined') {
      setPermission(Notification.permission)
    }
  }, [])
  useEffect(() => {
    syncPermission()
  }, [syncPermission])
  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisibility = () => syncPermission()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [syncPermission])

  const doSubscribe = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !slug || !token) return false
    
    if (needsIOSHomeScreen) return false
    
    // Check permission early unless it's native (Capacitor doesn't use Notification API)
    if (!isNative && typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setPermission('denied')
      return false
    }
    
    const useFCM = typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()
    if (!useFCM && !VAPID_PUBLIC) return false
    setLoading(true)
    try {
      if (useFCM) {
        const { token: fcmToken, permissionState } = await getCustomerPushSubscriptionToken(true)
        if (permissionState === 'denied' && !isNative) {
           setPermission('denied')
           return false
        } else if (permissionState === 'granted') {
           setPermission('granted')
        }
        
        if (fcmToken) {
          const apiUrl = `/api/tenants/${encodeURIComponent(slug)}/track/${encodeURIComponent(token)}/push-subscription`
          const pushClient = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform() ? 'native' : (isStandalone() ? 'pwa' : 'browser')
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fcmToken,
              source: 'customer-track',
              isIOS,
              standalone: isStandalone() || isNative,
              pushClient,
            }),
          })
          if (res.ok) {
            setStoredPushOk(PUSH_CONTEXT_KEYS.customer(slug, token))
            setHasPush(true)
            return true
          }
        }
      }

      // VAPID fallback path (only applies if web without FCM, and requires SW)
      if (VAPID_PUBLIC && !isNative && 'serviceWorker' in navigator) {
        let reg = await navigator.serviceWorker.getRegistration('/')
        if (!reg) {
          await navigator.serviceWorker.register('/customer-sw.js', { scope: '/' })
          reg = await navigator.serviceWorker.ready
        }
        if (!reg) return false
        
        let perm = Notification.permission
        if (perm !== 'granted') {
          perm = await Notification.requestPermission()
          setPermission(perm)
        }
        if (perm !== 'granted') return false
        
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
        })
        const p256 = new Uint8Array(subscription.getKey('p256dh')!)
        const auth = new Uint8Array(subscription.getKey('auth')!)
        const pushClient = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform() ? 'native' : (isStandalone() ? 'pwa' : 'browser')
        const apiUrl = `/api/tenants/${encodeURIComponent(slug)}/track/${encodeURIComponent(token)}/push-subscription`
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            source: 'customer-track',
            isIOS,
            standalone: isStandalone(),
            pushClient,
            keys: {
              p256dh: btoa(String.fromCharCode.apply(null, Array.from(p256))),
              auth: btoa(String.fromCharCode.apply(null, Array.from(auth))),
            },
          }),
        })
        if (res.ok) {
          setStoredPushOk(PUSH_CONTEXT_KEYS.customer(slug, token))
          setHasPush(true)
          return true
        }
      }
      return false
    } catch {
      return false
    } finally {
      setLoading(false)
    }
  }, [slug, token, isIOS, needsIOSHomeScreen, isNative])

  const subscribe = useCallback(async () => {
    await doSubscribe()
  }, [doSubscribe])

  const [isRefreshing, setIsRefreshing] = useState(false)
  const refreshToken = useCallback(async (): Promise<boolean> => {
    setIsRefreshing(true)
    const contextKey = PUSH_CONTEXT_KEYS.customer(slug, token)
    clearStoredPushOk(contextKey)
    setHasPush(false)
    try {
      const ok = await doSubscribe()
      return ok
    } finally {
      setIsRefreshing(false)
    }
  }, [doSubscribe, slug, token])

  useEffect(() => {
    if (!needsRefresh || permission !== 'granted') return
    setNeedsRefresh(false)
    doSubscribe().catch(() => {})
  }, [needsRefresh, permission, doSubscribe])

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
      if (permission === 'denied' || permission === 'granted') return
      
      const timeoutId = setTimeout(() => {
        if (!hasPush) doSubscribe().catch(() => {})
      }, 1500)
      
      let listener: any = null
      import('@capacitor/app').then(({ App }) => {
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive && !hasPush) {
            doSubscribe().catch(() => {})
          }
        }).then(l => listener = l)
      }).catch(() => {})
      
      return () => {
        clearTimeout(timeoutId)
        if (listener) listener.remove()
      }
    }
  }, [permission, hasPush, doSubscribe])

  useEffect(() => {
    if (!checked || permission !== 'granted') return
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        checkHasPush().catch(() => {})
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible)
    }
    const intervalId = setInterval(() => {
      checkHasPush().catch(() => {})
    }, 10 * 60 * 1000)
    return () => {
      clearInterval(intervalId)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible)
      }
    }
  }, [checked, permission, checkHasPush])

  const trulyEnabled = hasPush && (isNative || permission === 'granted')

  return {
    hasPush: trulyEnabled,
    checked,
    loading,
    permission,
    needsIOSHomeScreen,
    isIOS,
    isAndroid,
    checkHasPush,
    doSubscribe,
    subscribe,
    refreshToken,
    isRefreshing,
    lastServerStatus,
  }
}
