'use client'

import { useState, useEffect, useCallback } from 'react'
import { getFCMToken } from '@/lib/firebase'
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
  const needsIOSHomeScreen = isIOS && !isStandalone()

  const checkHasPush = useCallback(async () => {
    if (!slug || !token) return
    const contextKey = PUSH_CONTEXT_KEYS.customer(slug, token)
    const perm = typeof Notification !== 'undefined' ? Notification.permission : null
    if (perm === 'denied') {
      clearStoredPushOk(contextKey)
      setHasPush(false)
      setChecked(true)
      return
    }
    if (perm === 'granted' && getStoredPushOk(contextKey)) {
      setHasPush(true)
      setChecked(true)
      return
    }
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(slug)}/track/${encodeURIComponent(token)}/push-subscription`)
      const data = await res.json()
      const ok = data?.hasPush === true
      if (ok) setStoredPushOk(contextKey)
      else clearStoredPushOk(contextKey)
      setHasPush(ok)
    } catch {
      setHasPush(false)
    } finally {
      setChecked(true)
    }
  }, [slug, token])

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
    if (!('Notification' in window)) return false
    if (isIOS && !isStandalone()) return false
    const permNow = Notification.permission
    if (permNow === 'denied') {
      setPermission('denied')
      return false
    }
    if (!('serviceWorker' in navigator)) return false
    const useFCM = typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()
    if (!useFCM && !VAPID_PUBLIC) return false
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.register('/customer-sw.js', { scope: '/' })
      await navigator.serviceWorker.ready
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return false

      const apiUrl = `/api/tenants/${encodeURIComponent(slug)}/track/${encodeURIComponent(token)}/push-subscription`

      if (useFCM) {
        const { token: fcmToken } = await getFCMToken(reg)
        if (fcmToken) {
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fcmToken,
              source: 'customer-track',
              isIOS,
              standalone: isStandalone(),
            }),
          })
          if (res.ok) {
            setStoredPushOk(PUSH_CONTEXT_KEYS.customer(slug, token))
            setHasPush(true)
            return true
          }
        }
      }

      if (VAPID_PUBLIC) {
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
        })
        const p256 = new Uint8Array(subscription.getKey('p256dh')!)
        const auth = new Uint8Array(subscription.getKey('auth')!)
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            source: 'customer-track',
            isIOS,
            standalone: isStandalone(),
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
  }, [slug, token, isIOS])

  const subscribe = useCallback(async () => {
    await doSubscribe()
  }, [doSubscribe])

  const [isRefreshing, setIsRefreshing] = useState(false)
  const refreshToken = useCallback(async () => {
    setIsRefreshing(true)
    const contextKey = PUSH_CONTEXT_KEYS.customer(slug, token)
    clearStoredPushOk(contextKey)
    setHasPush(false)
    await doSubscribe()
    setIsRefreshing(false)
  }, [doSubscribe, slug, token])

  useEffect(() => {
    if (!checked || hasPush || permission !== 'granted') return
    checkHasPush().catch(() => {})
    const intervalId = setInterval(() => {
      checkHasPush().catch(() => {})
    }, 8000)
    return () => clearInterval(intervalId)
  }, [checked, hasPush, permission, checkHasPush])

  const trulyEnabled = hasPush && permission === 'granted'

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
  }
}
