'use client'

/**
 * PWA Permissions – Standalone Permissions Dialog
 * Shows notification + location permission requests when running inside an installed PWA.
 * M3 design, compact layout, icon-led with concise copy.
 *
 * Location detection: Trust Permissions API when it says 'granted' (avoids getCurrentPosition
 * which can hang or fail with POSITION_UNAVAILABLE even when permission is granted, e.g. indoors).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Bell, MapPin, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useLanguage } from '@/components/LanguageContext'
import { useToast } from '@/components/ui/ToastProvider'
import { isFirebaseConfigured } from '@/lib/firebase-config'
import type { PWAConfig, OSInfo, FCMState } from '@/lib/pwa/types'
import { STORAGE_KEY_PERMISSIONS_DISMISSED } from '@/lib/pwa/constants'

interface PWAPermissionsProps {
  config: PWAConfig
  os: OSInfo
  fcm: FCMState
  /** Only show when the user is in an order flow */
  inOrderFlow?: boolean
}

export function PWAPermissions({ config, os, fcm, inOrderFlow = false }: PWAPermissionsProps) {
  const { t, lang } = useLanguage()
  const { showToast } = useToast()
  const isRtl = lang === 'ar'
  const [dismissed, setDismissed] = useState(false)
  const [locationState, setLocationState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt')
  const [locationChecking, setLocationChecking] = useState(false)
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const syncLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return
    if (!('permissions' in navigator)) {
      setLocationState((prev) => (prev === 'granted' ? prev : 'prompt'))
      return
    }
    const perms = (navigator as { permissions?: { query: (p: { name: string }) => Promise<{ state: string }> } }).permissions
    if (!perms?.query) {
      setLocationState('prompt')
      return
    }
    perms.query({ name: 'geolocation' }).then((r) => {
      if (r.state === 'granted') {
        setLocationState('granted')
      } else if (r.state === 'denied') {
        setLocationState('denied')
      } else {
        setLocationState('prompt')
      }
    }).catch(() => setLocationState('prompt'))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      setDismissed(sessionStorage.getItem(STORAGE_KEY_PERMISSIONS_DISMISSED) === '1')
    } catch {}

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationState('unsupported')
    } else {
      syncLocation()
    }
    const onVisibility = () => syncLocation()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current)
        checkTimeoutRef.current = null
      }
    }
  }, [syncLocation])

  const dismissCard = useCallback(() => {
    setDismissed(true)
    try { sessionStorage.setItem(STORAGE_KEY_PERMISSIONS_DISMISSED, '1') } catch {}
  }, [])

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    if (locationChecking) return
    setLocationChecking(true)
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current)
    checkTimeoutRef.current = setTimeout(() => {
      setLocationChecking(false)
      checkTimeoutRef.current = null
    }, 6000)

    navigator.geolocation.getCurrentPosition(
      () => {
        if (checkTimeoutRef.current) {
          clearTimeout(checkTimeoutRef.current)
          checkTimeoutRef.current = null
        }
        setLocationState('granted')
        setLocationChecking(false)
        syncLocation()
        showToast(
          t('Location enabled. It helps with delivery and nearby stores.', 'تم تفعيل الموقع. يساعد في التوصيل والعروض القريبة.'),
          undefined, 'success'
        )
      },
      (err: GeolocationPositionError) => {
        if (checkTimeoutRef.current) {
          clearTimeout(checkTimeoutRef.current)
          checkTimeoutRef.current = null
        }
        setLocationChecking(false)
        if (err.code === 1) {
          setLocationState('denied')
          const instructions = os.isIOS
            ? t('To enable: open iPhone Settings → Privacy & Security → Location Services → turn On, then find this app (or Safari) and set to "While Using the App". Return here and tap Enable again.', 'للتفعيل: الإعدادات → الخصوصية والأمان → خدمات الموقع → تفعيل، ثم اختر هذا التطبيق (أو Safari) واختر "أثناء استخدام التطبيق". ارجع هنا واضغط تفعيل مرة أخرى.')
            : os.isAndroid
              ? t('To enable: open device Settings → Apps → find this app → Permissions → Location → Allow. Return here and tap Enable again.', 'للتفعيل: الإعدادات → التطبيقات → هذا التطبيق → الأذونات → الموقع → السماح. ارجع واضغط تفعيل مرة أخرى.')
              : t('Enable location in your browser or device Settings (Privacy → Location), then tap Enable again.', 'فعّل الموقع من إعدادات المتصفح أو الجهاز (الخصوصية → الموقع)، ثم اضغط تفعيل مرة أخرى.')
          showToast(instructions, undefined, 'info')
        } else {
          setLocationState('prompt')
          if (err.code === 2) {
            showToast(
              t('Could not get location. Try again when you have a clear sky view or move to a window.', 'تعذّر تحديد الموقع. حاول مرة أخرى عند وضوح السماء أو انقلك إلى نافذة.'),
              undefined, 'info'
            )
          }
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    )
  }, [os, showToast, t, syncLocation, locationChecking])

  const handleRequestPush = useCallback(async () => {
    if (typeof window !== 'undefined' && Notification.permission === 'denied') {
      showToast(
        t('Enable notifications in your browser or device Settings to receive order updates and offers.', 'فعّل الإشعارات من إعدادات المتصفح أو الجهاز لاستقبال تحديثات الطلبات والعروض.'),
        undefined, 'info'
      )
      return
    }
    const ok = await fcm.requestPush()
    if (ok) {
      showToast(
        t("Notifications enabled. You'll receive order updates and offers.", 'تم تفعيل الإشعارات. ستستقبل تحديثات الطلبات والعروض.'),
        undefined, 'success'
      )
    }
  }, [fcm, showToast, t])

  // Only show in standalone mode, in order flow, when not dismissed
  const canPush = typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()
  const canLocation = typeof navigator !== 'undefined' && !!navigator.geolocation && locationState !== 'unsupported'
  const pushGranted = fcm.permission === 'granted'
  const locationGranted = locationState === 'granted'
  const bothGranted = (!canPush || pushGranted) && (!canLocation || locationGranted)

  // Auto-dismiss when both are granted
  useEffect(() => {
    if (os.isStandalone && bothGranted) dismissCard()
  }, [os.isStandalone, bothGranted, dismissCard])

  const shouldShow = os.isStandalone && inOrderFlow && !dismissed && !bothGranted

  if (!shouldShow) return null

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) dismissCard() }}>
      <DialogContent
        showCloseButton={false}
        dir={isRtl ? 'rtl' : 'ltr'}
        className="max-w-[320px] p-4 border border-border bg-card shadow-[var(--m3-elevation-3)]"
        contentClassName="z-[100]"
        overlayClassName="z-[99]"
        style={{ touchAction: 'manipulation' }}
      >
        <div className="relative pt-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={dismissCard}
            className="absolute top-0 end-0 -me-2 -mt-2 z-20 size-8 shrink-0 rounded-lg"
            aria-label={t('Close', 'إغلاق')}
          >
            <X className="size-4" />
          </Button>

          {/* Compact header: icon + short title + subtitle */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-muted flex items-center justify-center overflow-hidden p-1">
              <img src={config.icon} alt="" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h3 className="text-foreground font-semibold text-sm leading-tight">
                {t('Allow notifications & location', 'السماح بالإشعارات والموقع')}
              </h3>
              <p className="text-muted-foreground text-xs mt-0.5">
                {t('Order updates & delivery', 'تحديثات الطلبات والتوصيل')}
              </p>
            </div>
          </div>

          {/* Icon-led permission rows (M3 8dp spacing) */}
          <div className="space-y-2">
            {canPush && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-muted/60 border border-border/80">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4 text-primary" aria-hidden />
                  </div>
                  <span className="text-foreground text-sm font-medium truncate">{t('Notifications', 'الإشعارات')}</span>
                </div>
                {pushGranted ? (
                  <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-primary/15 px-2 py-1">
                    <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden />
                    <span className="text-xs font-medium text-foreground">{t('On', 'مفعّل')}</span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleRequestPush}
                    disabled={fcm.loading || fcm.permission === 'denied'}
                    className="shrink-0 h-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 px-3 text-xs font-medium"
                  >
                    {fcm.loading ? t('…', '…') : t('Enable', 'تفعيل')}
                  </Button>
                )}
              </div>
            )}
            {canLocation && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-muted/60 border border-border/80">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-primary" aria-hidden />
                  </div>
                  <span className="text-foreground text-sm font-medium truncate">{t('Location', 'الموقع')}</span>
                </div>
                {locationGranted ? (
                  <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-primary/15 px-2 py-1">
                    <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden />
                    <span className="text-xs font-medium text-foreground">{t('On', 'مفعّل')}</span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={requestLocation}
                    disabled={locationChecking}
                    className="shrink-0 h-8 rounded-lg border-border bg-background hover:bg-muted px-3 text-xs font-medium"
                  >
                    {locationChecking ? t('…', '…') : locationState === 'denied' ? t('Retry', 'حاول') : t('Enable', 'تفعيل')}
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-border flex justify-end">
            <Button variant="ghost" size="sm" onClick={dismissCard} className="h-8 text-muted-foreground hover:text-foreground hover:bg-muted text-xs">
              {t('Not now', 'لاحقاً')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
