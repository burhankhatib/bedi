'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Download, X, Smartphone, Share2, Plus, Bell, MapPin, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useLanguage } from '@/components/LanguageContext'
import { useToast } from '@/components/ui/ToastProvider'
import { getFCMToken } from '@/lib/firebase'
import { isFirebaseConfigured } from '@/lib/firebase-config'

const STORAGE_KEY_INSTALL_DISMISSED = 'bedi-pwa-install-dismissed-until'
const DISMISS_HOURS_DEFAULT = 24
const DISMISS_HOURS_EXTENDED = 24 * 7 // 7 days

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstall() {
  const pathname = usePathname()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission | null>(null)
  const [locationState, setLocationState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt')
  const [locationChecking, setLocationChecking] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [showPermissionsSection, setShowPermissionsSection] = useState(false)
  const [permissionsCardDismissed, setPermissionsCardDismissed] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [dismissedUntilMs, setDismissedUntilMs] = useState<number | null>(null)
  const lastAutoPushSyncRef = useRef<string | null>(null)
  const { t, lang } = useLanguage()
  const { showToast } = useToast()
  const isRtl = lang === 'ar'

  const STORAGE_KEY_PERMISSIONS_DISMISSED = 'bedi-pwa-permissions-dismissed'

  // Only set location to "granted" when getCurrentPosition actually succeeds (Permissions API is unreliable, especially on iOS).
  const verifyLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    setLocationChecking(true)
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationState('granted')
        setLocationChecking(false)
      },
      (err: GeolocationPositionError) => {
        if (err.code === 1) setLocationState('denied')
        else if (err.code === 2) setLocationState('denied')
        else setLocationState('prompt')
        setLocationChecking(false)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
    )
  }, [])

  const syncPermissions = useCallback(() => {
    if (typeof window === 'undefined') return
    if (typeof Notification !== 'undefined') setPushPermission(Notification.permission)
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      // Never set 'granted' from Permissions API — it's unreliable on iOS and can be stale. Use verifyLocation() for real state.
      if (!('permissions' in navigator)) {
        setLocationState((prev) => (prev === 'granted' ? prev : 'prompt'))
        return
      }
      const perms = (navigator as { permissions?: { query: (p: { name: string }) => Promise<{ state: string }> } }).permissions
      if (perms?.query) {
        perms.query({ name: 'geolocation' }).then((r) => {
          if (r.state === 'granted') {
            // Don't trust it: do a real check so we only show Enabled when we actually get a position
            verifyLocation()
          } else if (r.state === 'denied') setLocationState('denied')
          else setLocationState('prompt')
        }).catch(() => setLocationState('prompt'))
      } else {
        setLocationState('prompt')
      }
    } else setLocationState('unsupported')
  }, [verifyLocation])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const android = /Android/i.test(navigator.userAgent)
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: boolean }).MSStream
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    const inOrderFlow = Boolean(pathname && (pathname.startsWith('/order') || /^\/t\/[^/]+(\/|$)/.test(pathname)))
    setIsAndroid(android)
    setIsIOS(iOS)
    setIsStandalone(standalone)
    syncPermissions()
    const canPush = typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()
    const canLocation = typeof navigator !== 'undefined' && !!navigator.geolocation
    // Only ask for permissions while placing orders in browser (not inside installed PWA).
    setShowPermissionsSection((canPush || canLocation) && inOrderFlow && !standalone)
    try {
      setPermissionsCardDismissed(sessionStorage.getItem(STORAGE_KEY_PERMISSIONS_DISMISSED) === '1')
      const until = localStorage.getItem(STORAGE_KEY_INSTALL_DISMISSED)
      if (until) {
        const ms = parseInt(until, 10)
        if (!Number.isNaN(ms)) setDismissedUntilMs(ms)
      }
    } catch {
      // ignore
    }
  }, [pathname, syncPermissions])

  const syncCustomerPushSubscription = useCallback(async (opts?: { allowPrompt?: boolean; source?: string }) => {
    const allowPrompt = opts?.allowPrompt === true
    const source = opts?.source ?? 'unknown'
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) return false
    if (typeof isFirebaseConfigured !== 'function' || !isFirebaseConfigured()) return false
    if (Notification.permission === 'denied') return false
    if (isIOS && !isStandalone) {
      if (allowPrompt) {
        showToast(
          t(
            'On iPhone/iPad, add Bedi to Home Screen first, then open from the app icon and enable notifications.',
            'على iPhone/iPad أضف Bedi إلى الشاشة الرئيسية أولاً، ثم افتحه من أيقونة التطبيق وفعّل الإشعارات.'
          ),
          undefined,
          'info'
        )
      }
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

      let perm: NotificationPermission = Notification.permission
      if (allowPrompt && perm !== 'granted') {
        perm = await Notification.requestPermission()
      }
      setPushPermission(perm)
      if (perm !== 'granted') {
        if (allowPrompt && perm === 'denied') {
          showToast(
            t('Enable notifications in Settings to get order updates and delivery alerts.', 'فعّل الإشعارات من الإعدادات لاستقبال تحديثات الطلبات وتنبيهات التوصيل.'),
            undefined,
            'info'
          )
        }
        return false
      }

      const { token } = await getFCMToken(registration)
      if (!token) return false
      await fetch('/api/customer/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fcmToken: token, source, isIOS, standalone: isStandalone }),
      })
      return true
    } catch {
      return false
    } finally {
      setPushLoading(false)
    }
  }, [isIOS, isStandalone, showToast, t])

  const requestPush = useCallback(async () => {
    if (typeof window !== 'undefined' && Notification.permission === 'denied') {
      showToast(
        t('Enable notifications in your browser or device Settings to receive order updates and offers.', 'فعّل الإشعارات من إعدادات المتصفح أو الجهاز لاستقبال تحديثات الطلبات والعروض.'),
        undefined,
        'info'
      )
      return false
    }
    const ok = await syncCustomerPushSubscription({ allowPrompt: true, source: 'pwa-install-manual' })
    if (ok) {
      showToast(
        t("Notifications enabled. You'll receive order updates and offers.", 'تم تفعيل الإشعارات. ستستقبل تحديثات الطلبات والعروض.'),
        undefined,
        'success'
      )
    }
    return ok
  }, [showToast, syncCustomerPushSubscription, t])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) return
    const inOrderFlow = Boolean(pathname && (pathname.startsWith('/order') || /^\/t\/[^/]+(\/|$)/.test(pathname)))
    if (!inOrderFlow) return
    if (Notification.permission !== 'granted') return
    const key = `${pathname}|${isStandalone ? 'standalone' : 'browser'}|${isIOS ? 'ios' : 'other'}`
    if (lastAutoPushSyncRef.current === key) return
    lastAutoPushSyncRef.current = key
    void syncCustomerPushSubscription({ allowPrompt: false, source: 'order-flow-auto' })
  }, [pathname, isStandalone, isIOS, syncCustomerPushSubscription])

  const getLocationDeniedInstructions = useCallback(() => {
    if (isIOS) {
      return t(
        'To enable: open iPhone Settings → Privacy & Security → Location Services → turn On, then find this app (or Safari) and set to "While Using the App" or "Ask Next Time". Return here and tap Enable again.',
        'للتفعيل: الإعدادات → الخصوصية والأمان → خدمات الموقع → تفعيل، ثم اختر هذا التطبيق (أو Safari) واختر "أثناء استخدام التطبيق" أو "السؤال في المرة القادمة". ارجع هنا واضغط تفعيل مرة أخرى.'
      )
    }
    if (isAndroid) {
      return t(
        'To enable: open device Settings → Apps → find this app → Permissions → Location → Allow. Return here and tap Enable again.',
        'للتفعيل: الإعدادات → التطبيقات → هذا التطبيق → الأذونات → الموقع → السماح. ارجع واضغط تفعيل مرة أخرى.'
      )
    }
    return t(
      'Enable location in your browser or device Settings (Privacy → Location), then tap Enable again.',
      'فعّل الموقع من إعدادات المتصفح أو الجهاز (الخصوصية → الموقع)، ثم اضغط تفعيل مرة أخرى.'
    )
  }, [isIOS, isAndroid, t])

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    setLocationChecking(true)
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationState('granted')
        setLocationChecking(false)
        syncPermissions()
        showToast(
          t('Location enabled. It helps with delivery and nearby stores.', 'تم تفعيل الموقع. يساعد في التوصيل والعروض القريبة.'),
          undefined,
          'success'
        )
      },
      (err: GeolocationPositionError) => {
        setLocationState('denied')
        setLocationChecking(false)
        if (err.code === 1) {
          showToast(getLocationDeniedInstructions(), undefined, 'info')
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
    )
  }, [syncPermissions, showToast, t, getLocationDeniedInstructions])

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      // Check if already installed
      if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone) {
        setIsStandalone(true)
        return
      }

      // Detect iOS
      const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: boolean }).MSStream
      setIsIOS(iOS)

      // Listen for beforeinstallprompt event (Android)
      const handleBeforeInstallPrompt = (e: Event) => {
        try {
          setDeferredPrompt(e as BeforeInstallPromptEvent)
          setShowInstallPrompt(true)
        } catch {
          // avoid uncaught errors in PWA install flow
        }
      }

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

      // Encourage install after the user had time to explore the page.
      const delayMs = 10000
      const timer = setTimeout(() => setShowInstallPrompt(true), delayMs)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      }
    } catch {
      return undefined
    }
  }, [])

  const [showFallbackHint, setShowFallbackHint] = useState(false)

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') {
          setDeferredPrompt(null)
          setShowInstallPrompt(false)
        }
      } catch {
        // PWA install can fail; avoid breaking the page
      }
      return
    }
    // No native prompt yet (e.g. browser didn't fire beforeinstallprompt): show hint so the button still does something
    setShowFallbackHint(true)
    setTimeout(() => setShowFallbackHint(false), 4000)
  }

  const now = typeof window !== 'undefined' ? Date.now() : 0
  const dismissExpired = dismissedUntilMs === null || now >= dismissedUntilMs
  const showInstallCard = !isStandalone && showInstallPrompt && dismissExpired
  const canPush = typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()
  const canLocation = typeof navigator !== 'undefined' && !!navigator.geolocation && locationState !== 'unsupported'
  const pushGranted = pushPermission === 'granted'
  const locationGranted = locationState === 'granted'
  // Show close (X) only when both supported permissions are granted (or only one is supported and that one is granted)
  const bothPermissionsGranted = (!canPush || pushGranted) && (!canLocation || locationGranted)
  const showStandalonePermissions = isStandalone && showPermissionsSection && !permissionsCardDismissed
  // When both are already enabled, do not show the box at all (no need to prompt and no close button needed).
  const needsPermissionPrompt = showStandalonePermissions && !bothPermissionsGranted

  const dismissPermissionsCard = useCallback(() => {
    setPermissionsCardDismissed(true)
    try {
      sessionStorage.setItem(STORAGE_KEY_PERMISSIONS_DISMISSED, '1')
    } catch {
      // ignore
    }
  }, [])

  // When both permissions become granted in standalone, auto-dismiss so we don't show the card on next visit.
  useEffect(() => {
    if (isStandalone && bothPermissionsGranted && showPermissionsSection) {
      dismissPermissionsCard()
    }
  }, [isStandalone, bothPermissionsGranted, showPermissionsSection, dismissPermissionsCard])

  const dismissInstallModal = useCallback((forHours: number = DISMISS_HOURS_DEFAULT) => {
    const until = Date.now() + forHours * 60 * 60 * 1000
    setDismissedUntilMs(until)
    setShowInstallPrompt(false)
    try {
      localStorage.setItem(STORAGE_KEY_INSTALL_DISMISSED, String(until))
    } catch {
      // ignore
    }
  }, [])

  if (!showInstallCard && !needsPermissionPrompt) {
    return null
  }

  // Standalone PWA: show permissions in a modal only when at least one permission is not yet granted (not inline, so not hidden under header). Always show Close so user can dismiss.
  if (isStandalone && needsPermissionPrompt) {
    return (
      <Dialog open={true} onOpenChange={(open) => { if (!open) dismissPermissionsCard() }}>
        <DialogContent
          dir={isRtl ? 'rtl' : 'ltr'}
          className="max-w-lg border-emerald-500/30 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-5 shadow-lg shadow-emerald-900/20 md:p-6 overflow-y-auto max-h-[90vh] [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-white/20"
          contentClassName="z-[100]"
          overlayClassName="z-[99]"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="relative pt-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={dismissPermissionsCard}
              className="absolute top-0 end-0 -me-2 -mt-2 z-20 size-10 shrink-0 rounded-xl text-white/90 hover:bg-white/20 hover:text-white"
              aria-label={t('Close', 'إغلاق')}
            >
              <X className="size-5" />
            </Button>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 shrink-0 rounded-xl bg-white/20 flex items-center justify-center overflow-hidden p-1">
                <img src="/customerLogo.webp" alt="" className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-white font-black text-lg">
                  {t('Get the most out of the app', 'استفد من التطبيق بأقصى قدر')}
                </h3>
                <p className="text-emerald-100 text-sm">
                  {t('Enable notifications and location for order updates and delivery.', 'فعّل الإشعارات والموقع لتحديثات الطلبات والتوصيل.')}
                </p>
              </div>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/20 p-4 space-y-2.5">
              {canPush && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <Bell className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-emerald-100 text-sm font-medium">{t('Notifications', 'الإشعارات')}</span>
                  </div>
                  {pushPermission === 'granted' ? (
                    <div className="flex items-center gap-2 shrink-0 rounded-full bg-emerald-400/30 border border-emerald-300/50 px-3 py-1.5 text-emerald-50">
                      <CheckCircle2 className="w-4 h-4 text-emerald-200" aria-hidden />
                      <span className="text-sm font-semibold">{t('Enabled', 'مفعّل')}</span>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={requestPush}
                      disabled={pushLoading || pushPermission === 'denied'}
                      className="shrink-0 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/30"
                    >
                      {pushLoading ? t('Enabling…', 'جاري التفعيل…') : t('Enable', 'تفعيل')}
                    </Button>
                  )}
                </div>
              )}
              {canLocation && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-emerald-100 text-sm font-medium">{t('Location', 'الموقع')}</span>
                    </div>
                    {locationState === 'granted' ? (
                      <div className="flex items-center gap-2 shrink-0 rounded-full bg-emerald-400/30 border border-emerald-300/50 px-3 py-1.5 text-emerald-50">
                        <CheckCircle2 className="w-4 h-4 text-emerald-200" aria-hidden />
                        <span className="text-sm font-semibold">{t('Enabled', 'مفعّل')}</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={requestLocation}
                        disabled={locationChecking}
                        className="shrink-0 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/30"
                      >
                        {locationChecking ? t('Checking…', 'جاري التحقق…') : locationState === 'denied' ? t('Try again', 'حاول مرة أخرى') : t('Enable', 'تفعيل')}
                      </Button>
                    )}
                  </div>
                  {locationState === 'denied' && (
                    <p className="text-emerald-100/95 text-xs leading-snug px-1">
                      {getLocationDeniedInstructions()}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-white/20 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissPermissionsCard}
                className="text-emerald-100 hover:bg-white/20 hover:text-white"
              >
                {t('Close', 'إغلاق')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const installContent = (
    <>
      <div className="flex items-center gap-4 min-w-0 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner overflow-hidden p-1">
          <img src="/customerLogo.webp" alt="" className="w-full h-full object-contain" />
        </div>
        <div className="min-w-0">
          <h3 className="text-white font-black text-xl mb-1">
            {t('Get the app', 'احصل على التطبيق')}
          </h3>
          <p className="text-emerald-100 text-sm leading-snug">
            {t('Install for quick access, orders & offers right from your home screen.', 'ثبّته للوصول السريع والطلبات والعروض من الشاشة الرئيسية.')}
          </p>
        </div>
      </div>

      {/* Push + Location in same prompt with Enabled state */}
      {showPermissionsSection && (
        <div className="mb-4 rounded-xl bg-white/10 border border-white/20 p-4 space-y-3">
          <p className="text-white font-semibold text-sm mb-3">
            {t('Stay updated', 'ابقَ على اطلاع')}
          </p>
          <div className="space-y-2.5">
            {typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-emerald-100 text-sm font-medium">
                    {t('Notifications', 'الإشعارات')}
                  </span>
                </div>
                {pushPermission === 'granted' ? (
                  <div className="flex items-center gap-2 shrink-0 rounded-full bg-emerald-400/30 border border-emerald-300/50 px-3 py-1.5 text-emerald-50">
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" aria-hidden />
                    <span className="text-sm font-semibold">{t('Enabled', 'مفعّل')}</span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={requestPush}
                    disabled={pushLoading || pushPermission === 'denied'}
                    className="shrink-0 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/30"
                  >
                    {pushLoading ? t('Enabling…', 'جاري التفعيل…') : t('Enable', 'تفعيل')}
                  </Button>
                )}
              </div>
            )}
            {typeof navigator !== 'undefined' && navigator.geolocation && locationState !== 'unsupported' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-emerald-100 text-sm font-medium">
                      {t('Location', 'الموقع')}
                    </span>
                  </div>
                  {locationState === 'granted' ? (
                    <div className="flex items-center gap-2 shrink-0 rounded-full bg-emerald-400/30 border border-emerald-300/50 px-3 py-1.5 text-emerald-50">
                      <CheckCircle2 className="w-4 h-4 text-emerald-200" aria-hidden />
                      <span className="text-sm font-semibold">{t('Enabled', 'مفعّل')}</span>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={requestLocation}
                      disabled={locationChecking}
                      className="shrink-0 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/30"
                    >
                      {locationChecking ? t('Checking…', 'جاري التحقق…') : locationState === 'denied' ? t('Try again', 'حاول مرة أخرى') : t('Enable', 'تفعيل')}
                    </Button>
                  )}
                </div>
                {locationState === 'denied' && (
                  <p className="text-emerald-100/95 text-xs leading-snug px-1">
                    {getLocationDeniedInstructions()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {isIOS ? (
        <div className="space-y-4">
          <div className="bg-white/10 rounded-xl p-5 border border-white/20 backdrop-blur-sm">
            <p className="text-white font-bold text-base mb-4 text-center">
              {t('Install on iOS:', 'التثبيت على iOS:')}
            </p>
            <div className="space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/25 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">1</span>
                </div>
                <div className="flex-1 flex items-center gap-2 flex-wrap">
                  <span className="text-emerald-100 text-sm">{t('Tap the', 'اضغط على')}</span>
                  <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-lg border border-white/30">
                    <Share2 className="w-3.5 h-3.5 text-white" />
                    <span className="text-white text-xs font-semibold">{t('Share', 'مشاركة')}</span>
                  </div>
                  <span className="text-emerald-100 text-sm">{t('button at the bottom', 'في الأسفل')}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/25 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">2</span>
                </div>
                <div className="flex-1 flex items-center gap-2 flex-wrap">
                  <span className="text-emerald-100 text-sm">{t('Scroll and tap', 'قم بالتمرير واضغط على')}</span>
                  <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-lg border border-white/30">
                    <Plus className="w-3.5 h-3.5 text-white" />
                    <span className="text-white text-xs font-semibold">{t('Add to Home Screen', 'إضافة إلى الشاشة الرئيسية')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/25 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">3</span>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-emerald-100 text-sm">{t('Tap "Add" to confirm', 'اضغط "إضافة" للتأكيد')}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-emerald-200/90">
            <Smartphone className="w-4 h-4" />
            <span>{t('Works on iPhone and iPad', 'يعمل على iPhone و iPad')}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleInstallClick}
            className="w-full h-12 rounded-xl font-black text-base bg-white hover:bg-emerald-50 active:bg-emerald-100 text-emerald-800 flex items-center justify-center gap-2 shadow-md touch-manipulation select-none cursor-pointer border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-700"
            style={{ touchAction: 'manipulation' }}
          >
            <Download className="w-5 h-5 shrink-0 pointer-events-none" />
            {t('Install app', 'تثبيت التطبيق')}
          </button>
          {showFallbackHint && (
            <p className="text-xs text-emerald-200 text-center animate-in fade-in">
              {t('Open browser menu (⋮) → Install app', 'افتح قائمة المتصفح (⋮) → تثبيت التطبيق')}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-white/20 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => dismissInstallModal(DISMISS_HOURS_EXTENDED)}
          className="text-emerald-200 hover:text-white text-xs underline"
        >
          {t("Don't show for 7 days", 'عدم الإظهار لمدة 7 أيام')}
        </button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => dismissInstallModal(DISMISS_HOURS_DEFAULT)}
          className="bg-white/20 text-white hover:bg-white/30 border-0"
        >
          {t('Close', 'إغلاق')}
        </Button>
      </div>
    </>
  )

  return (
    <Dialog open={showInstallCard} onOpenChange={(open) => { if (!open) dismissInstallModal(DISMISS_HOURS_DEFAULT) }}>
      <DialogContent
        dir={isRtl ? 'rtl' : 'ltr'}
        className="max-w-lg border-emerald-500/30 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-5 shadow-lg shadow-emerald-900/20 md:p-6 overflow-y-auto max-h-[90vh] [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-white/20"
        contentClassName="z-[100]"
        overlayClassName="z-[99]"
        style={{ touchAction: 'manipulation' }}
      >
        {installContent}
      </DialogContent>
    </Dialog>
  )
}
