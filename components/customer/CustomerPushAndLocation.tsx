'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'
import { getFCMToken } from '@/lib/firebase'
import { isFirebaseConfigured } from '@/lib/firebase-config'

const STORAGE_KEY_DISMISSED = 'bedi-customer-push-dismissed'
const AUTO_PROMPT_DELAY_MS = 2000

export function CustomerPushAndLocation() {
  const { t } = useLanguage()
  const [mounted, setMounted] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission | null>(null)
  const [locationState, setLocationState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt')
  const [pushLoading, setPushLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showManualInstructions, setShowManualInstructions] = useState(false)

  const syncPermissions = useCallback(() => {
    if (typeof window === 'undefined') return
    if (typeof Notification !== 'undefined') setPushPermission(Notification.permission)
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      if (!('permissions' in navigator)) {
        setLocationState('unsupported')
        return
      }
      const perms = (navigator as { permissions?: { query: (p: { name: string }) => Promise<{ state: string }> } }).permissions
      if (perms?.query) {
        perms.query({ name: 'geolocation' }).then((r) => {
          if (r.state === 'granted') setLocationState('granted')
          else if (r.state === 'denied') setLocationState('denied')
          else setLocationState('prompt')
        }).catch(() => setLocationState('unsupported'))
      } else setLocationState('prompt')
    } else setLocationState('unsupported')
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])
  useEffect(() => {
    if (!mounted) return
    syncPermissions()
    try {
      setDismissed(sessionStorage.getItem(STORAGE_KEY_DISMISSED) === '1')
    } catch {
      // ignore
    }
  }, [mounted, syncPermissions])

  const requestPush = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) return false
    if (typeof isFirebaseConfigured !== 'function' || !isFirebaseConfigured()) return false
    if (Notification.permission === 'denied') {
      setShowManualInstructions(true)
      return false
    }
    setPushLoading(true)
    try {
      let registration = await navigator.serviceWorker.getRegistration('/')
      if (!registration) {
        await navigator.serviceWorker.register('/customer-sw.js', { scope: '/' })
        registration = await navigator.serviceWorker.ready
      }
      if (!registration) return false
      const perm = await Notification.requestPermission()
      setPushPermission(perm)
      if (perm !== 'granted') return false
      const { token } = await getFCMToken(registration)
      if (token) {
        await fetch('/api/customer/push-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fcmToken: token }),
        })
      }
      return true
    } catch {
      return false
    } finally {
      setPushLoading(false)
    }
  }, [])

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationState('granted')
        syncPermissions()
      },
      () => {
        setLocationState('denied')
        setShowManualInstructions(true)
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
    )
  }, [syncPermissions])

  const dismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(STORAGE_KEY_DISMISSED, '1')
    } catch {
      // ignore
    }
  }

  if (!mounted || dismissed) return null
  const canUsePush = typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()
  const needsPush = canUsePush && pushPermission !== 'granted' && typeof Notification !== 'undefined'
  const needsLocation = locationState === 'prompt' && typeof navigator !== 'undefined' && !!navigator.geolocation
  const showBanner = (needsPush || needsLocation) && (pushPermission !== 'denied' || locationState !== 'denied' || showManualInstructions)

  if (!showBanner) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 md:bottom-6 md:left-6 md:right-auto md:max-w-sm" role="region" aria-label={t('Notifications & location', 'الإشعارات والموقع')}>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex gap-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm">
                {t('Stay updated', 'ابقَ على اطلاع')}
              </h3>
              <p className="text-slate-600 text-xs mt-0.5">
                {t('Enable notifications for order updates and offers. Location helps show nearby businesses.', 'فعّل الإشعارات لتحديثات الطلبات والعروض. الموقع يساعد في عرض الأعمال القريبة.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={t('Dismiss', 'إغلاق')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {showManualInstructions && (pushPermission === 'denied' || locationState === 'denied') && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            <p className="font-medium mb-1">{t('To enable manually:', 'للتشغيل يدوياً:')}</p>
            <p>
              {t('Open your browser or device Settings → find this site (Bedi) → allow Notifications and Location.', 'افتح إعدادات المتصفح أو الجهاز → ابحث عن هذا الموقع (Bedi) → اسمح بالإشعارات والموقع.')}
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2">
          {needsPush && pushPermission !== 'denied' && (
            <Button
              size="sm"
              onClick={requestPush}
              disabled={pushLoading}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700"
            >
              <Bell className="w-4 h-4 mr-2" />
              {pushLoading ? t('Enabling…', 'جاري التفعيل…') : t('Enable notifications', 'تفعيل الإشعارات')}
            </Button>
          )}
          {needsLocation && (
            <Button
              size="sm"
              variant="outline"
              onClick={requestLocation}
              className="w-full rounded-xl"
            >
              <MapPin className="w-4 h-4 mr-2" />
              {t('Enable location', 'تفعيل الموقع')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
