'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { getFCMToken } from '@/lib/firebase'
import { isFirebaseConfigured } from '@/lib/firebase-config'
import { getStoredPushOk, setStoredPushOk, clearStoredPushOk, PUSH_CONTEXT_KEYS } from '@/lib/push-storage'

const VAPID_PUBLIC = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY : undefined
const AUTO_PROMPT_DELAY_MS = 1500
const REMINDER_INTERVAL_MS = 20000

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

type Props = { slug: string; token: string }

export function CustomerTrackPushSetup({ slug, token }: Props) {
  const { t } = useLanguage()
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

  // Keep permission in sync with browser (e.g. user revokes in settings)
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
    if (isIOS && !isStandalone()) {
      return false
    }
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

      // Prefer Firebase (FCM) so Chrome and other browsers deliver notifications when the tab is closed
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

      // Fallback: Web Push (VAPID)
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

  const subscribe = async () => {
    await doSubscribe()
  }

  const deniedInstructions = useCallback(() => {
    if (isIOS) {
      return t(
        'On iPhone/iPad: Settings → Safari → Notifications → Allow for this site, then reopen the order page and tap Enable.',
        'على iPhone/iPad: الإعدادات → Safari → الإشعارات → السماح لهذا الموقع، ثم أعد فتح صفحة الطلب واضغط تفعيل.'
      )
    }
    if (isAndroid) {
      return t(
        'On Android: Browser site settings → Notifications → Allow, then return and tap Enable.',
        'على Android: إعدادات الموقع في المتصفح → الإشعارات → السماح، ثم ارجع واضغط تفعيل.'
      )
    }
    return t(
      'On Desktop: click the lock icon near the address bar → Notifications → Allow, then refresh and tap Enable.',
      'على سطح المكتب: اضغط أيقونة القفل بجانب شريط العنوان → الإشعارات → السماح، ثم حدّث الصفحة واضغط تفعيل.'
    )
  }, [isAndroid, isIOS, t])

  // Keep reminding and retrying notification permission until enabled.
  // Browsers may require user gesture after initial prompt, so the button remains visible at all times.
  const trulyEnabledForEffect = hasPush && permission === 'granted'
  useEffect(() => {
    if (!checked || trulyEnabledForEffect || !slug || !token) return
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const canPush = (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()) || !!VAPID_PUBLIC
    if (!canPush) return
    if (isIOS && !isStandalone()) return

    const tryEnable = () => {
      const perm = Notification.permission
      if (perm === 'denied') return
      if (perm === 'granted') {
        doSubscribe().catch(() => {})
        return
      }
      Notification.requestPermission()
        .then((p) => {
          setPermission(p)
          if (p === 'granted') doSubscribe().catch(() => {})
        })
        .catch(() => {})
    }

    const timeoutId = setTimeout(tryEnable, AUTO_PROMPT_DELAY_MS)
    const intervalId = setInterval(tryEnable, REMINDER_INTERVAL_MS)
    return () => {
      clearTimeout(timeoutId)
      clearInterval(intervalId)
    }
  }, [checked, trulyEnabledForEffect, slug, token, doSubscribe, permission, isIOS])

  // If browser permission is granted but API state is not yet reflected, keep checking until backend confirms.
  useEffect(() => {
    if (!checked || hasPush || permission !== 'granted') return
    checkHasPush().catch(() => {})
    const intervalId = setInterval(() => {
      checkHasPush().catch(() => {})
    }, 8000)
    return () => clearInterval(intervalId)
  }, [checked, hasPush, permission, checkHasPush])

  // Only consider enabled when both API has subscription AND browser permission is granted
  const trulyEnabled = hasPush && permission === 'granted'

  if (!checked) return null

  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-5">
      <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
        {trulyEnabled ? (
          <>
            <Bell className="h-4 w-4 text-emerald-600" />
            {t('Status notifications enabled', 'تم تفعيل إشعارات حالة الطلب')}
          </>
        ) : (
          <>
            <BellOff className="h-4 w-4 text-slate-500" />
            {t('Get a notification every time your order status changes', 'استلم إشعاراً عند كل تغيير في حالة الطلب')}
          </>
        )}
      </p>
      {!trulyEnabled && (
        <>
          <p className="mt-2 text-xs text-slate-500">
            {t('We will keep reminding you until notifications are enabled.', 'سنستمر بتذكيرك حتى يتم تفعيل الإشعارات.')}
          </p>
          {needsIOSHomeScreen && (
            <p className="mt-2 text-xs text-amber-700">
              {t(
                'On iPhone/iPad, push works after adding Bedi to Home Screen. Open from the app icon, then tap Enable.',
                'على iPhone/iPad تعمل الإشعارات بعد إضافة Bedi إلى الشاشة الرئيسية. افتحه من أيقونة التطبيق ثم اضغط تفعيل.'
              )}
            </p>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              if (needsIOSHomeScreen) {
                if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                  window.alert(
                    t(
                      'Add this page to Home Screen first, open it from the app icon, then tap Enable again.',
                      'أضف هذه الصفحة إلى الشاشة الرئيسية أولاً، وافتحها من أيقونة التطبيق، ثم اضغط تفعيل مرة أخرى.'
                    )
                  )
                }
                return
              }
              if (permission === 'denied') {
                if (typeof window !== 'undefined') {
                  if (typeof window.alert === 'function') window.alert(deniedInstructions())
                }
                return
              }
              subscribe()
            }}
            disabled={loading}
            className="mt-3 flex min-h-[48px] w-full touch-manipulation cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 active:scale-[0.98]"
          >
            {loading
              ? t('Enabling…', 'جاري التفعيل…')
              : needsIOSHomeScreen
                ? t('Open from Home Screen first', 'افتح من الشاشة الرئيسية أولاً')
                : t('Enable status notifications', 'تفعيل إشعارات الحالة')}
          </button>
          {permission === 'denied' && (
            <p className="mt-2 text-xs text-amber-700">
              {deniedInstructions()}
            </p>
          )}
        </>
      )}
    </div>
  )
}
