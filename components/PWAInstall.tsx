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
  const [isDesktop, setIsDesktop] = useState(false)
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
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const lastAutoPushSyncRef = useRef<string | null>(null)
  const { t, lang } = useLanguage()
  const { showToast } = useToast()
  const isRtl = lang === 'ar'
  const inOrderFlow = Boolean(pathname && (pathname.startsWith('/order') || /^\/t\/[^/]+(\/|$)/.test(pathname)))

  const STORAGE_KEY_PERMISSIONS_DISMISSED = 'bedi-pwa-permissions-dismissed'

  const syncPermissions = useCallback(() => {
    if (typeof window === 'undefined') return
    if (typeof Notification !== 'undefined') setPushPermission(Notification.permission)
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      if (!('permissions' in navigator)) {
        setLocationState((prev) => (prev === 'granted' ? prev : 'prompt'))
        return
      }
      const perms = (navigator as { permissions?: { query: (p: { name: string }) => Promise<{ state: string }> } }).permissions
      if (perms?.query) {
        perms.query({ name: 'geolocation' }).then((r) => {
          if (r.state === 'granted') setLocationState('granted')
          else if (r.state === 'denied') setLocationState('denied')
          else setLocationState('prompt')
        }).catch(() => setLocationState('prompt'))
      } else {
        setLocationState('prompt')
      }
    } else setLocationState('unsupported')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const android = /Android/i.test(navigator.userAgent)
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: boolean }).MSStream
    const desktop = !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    setIsAndroid(android)
    setIsIOS(iOS)
    setIsDesktop(desktop)
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
  }, [inOrderFlow, syncPermissions])

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

  // Throttle: only auto-sync push once per 24h to avoid FCM spam on every navigation
  const ORDER_FLOW_PUSH_THROTTLE_MS = 24 * 60 * 60 * 1000
  const ORDER_FLOW_PUSH_KEY = 'bedi-order-flow-push-last'
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) return
    if (!inOrderFlow) return
    if (Notification.permission !== 'granted') return
    try {
      const last = Number(localStorage.getItem(ORDER_FLOW_PUSH_KEY) || '0')
      if (Number.isFinite(last) && Date.now() - last < ORDER_FLOW_PUSH_THROTTLE_MS) return
    } catch {
      /* ignore */
    }
    const key = `${pathname}|${isStandalone ? 'standalone' : 'browser'}|${isIOS ? 'ios' : 'other'}`
    if (lastAutoPushSyncRef.current === key) return
    lastAutoPushSyncRef.current = key
    void syncCustomerPushSubscription({ allowPrompt: false, source: 'order-flow-auto' }).then((ok) => {
      if (ok) try { localStorage.setItem(ORDER_FLOW_PUSH_KEY, String(Date.now())) } catch { /* ignore */ }
    })
  }, [inOrderFlow, pathname, isStandalone, isIOS, syncCustomerPushSubscription])

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
    if (locationChecking) return
    setLocationChecking(true)
    const guard = setTimeout(() => setLocationChecking(false), 6000)
    navigator.geolocation.getCurrentPosition(
      () => {
        clearTimeout(guard)
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
        clearTimeout(guard)
        setLocationChecking(false)
        if (err.code === 1) {
          setLocationState('denied')
          showToast(getLocationDeniedInstructions(), undefined, 'info')
        } else {
          setLocationState('prompt')
          if (err.code === 2) {
            showToast(
              t('Could not get location. Try again when you have a clear sky view or move to a window.', 'تعذّر تحديد الموقع. حاول مرة أخرى عند وضوح السماء أو انقلك إلى نافذة.'),
              undefined,
              'info'
            )
          }
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    )
  }, [syncPermissions, showToast, t, getLocationDeniedInstructions, locationChecking])

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
          ;(e as Event & { preventDefault?: () => void }).preventDefault?.()
          setDeferredPrompt(e as BeforeInstallPromptEvent)
        } catch {
          // avoid uncaught errors in PWA install flow
        }
      }

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

      // Friendlier trigger:
      // - Do not show during order flow
      // - Show after user engagement (scroll) or fallback delay
      let revealed = false
      const reveal = () => {
        if (revealed || inOrderFlow) return
        revealed = true
        setShowInstallPrompt(true)
      }
      const onScroll = () => {
        if (window.scrollY > 280) reveal()
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      const timer = setTimeout(reveal, 18000)

      return () => {
        clearTimeout(timer)
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      }
    } catch {
      return undefined
    }
  }, [inOrderFlow])

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
  const showInstallCard = !isStandalone && !inOrderFlow && showInstallPrompt && dismissExpired
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
                <img src="/customersLogo.webp" alt="" className="w-full h-full object-contain" />
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

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[90] md:inset-x-auto md:end-4 md:bottom-4 md:w-[420px]"
      style={{ touchAction: 'manipulation' }}
    >
      <div className="rounded-2xl border border-emerald-300/40 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-4 shadow-xl shadow-emerald-900/25">
        <div className="mb-3 flex items-start gap-3">
          <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/20 p-1">
            <img src="/customersLogo.webp" alt="" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-white">
              {t('Get Bedi on your device', 'احصل على Bedi على جهازك')}
            </h3>
            <p className="mt-0.5 text-xs leading-snug text-emerald-100">
              {t('Faster access from home screen, smoother checkout, and real-time updates.', 'وصول أسرع من الشاشة الرئيسية، وتجربة طلب أسلس، وتحديثات مباشرة.')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => dismissInstallModal(DISMISS_HOURS_DEFAULT)}
            className="shrink-0 rounded-lg bg-white/15 text-white hover:bg-white/25 hover:text-white"
            aria-label={t('Close', 'إغلاق')}
          >
            <X className="size-4" />
          </Button>
        </div>

        {isIOS ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-xl border border-white/20 bg-white/10 px-3 py-2">
              <div className="flex items-center gap-2 text-emerald-100">
                <Smartphone className="size-4" />
                <span className="text-xs font-semibold">{t('iPhone / iPad install', 'تثبيت iPhone / iPad')}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallHelp((v) => !v)}
                className="text-xs font-semibold text-white underline underline-offset-2"
              >
                {showInstallHelp ? t('Hide steps', 'إخفاء الخطوات') : t('Show steps', 'عرض الخطوات')}
              </button>
            </div>
            {showInstallHelp && (
              <ol className="space-y-2 rounded-xl border border-white/20 bg-white/10 p-3 text-xs text-emerald-100">
                <li className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-white">1</span>
                  <span>{t('Open this page in Safari.', 'افتح هذه الصفحة في Safari.')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-white">2</span>
                  <span>{t('Tap', 'اضغط')}</span>
                  <span className="inline-flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 text-white">
                    <Share2 className="size-3.5" />
                    {t('Share', 'مشاركة')}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-white">3</span>
                  <span>{t('Select', 'اختر')}</span>
                  <span className="inline-flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 text-white">
                    <Plus className="size-3.5" />
                    {t('Add to Home Screen', 'إضافة إلى الشاشة الرئيسية')}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-white">4</span>
                  <span>{t('Tap "Add", then open the app from your Home Screen.', 'اضغط "إضافة"، ثم افتح التطبيق من الشاشة الرئيسية.')}</span>
                </li>
              </ol>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-emerald-800 shadow-md transition-colors hover:bg-emerald-50"
            >
              <Download className="size-4.5 shrink-0" />
              <span className="font-bold">{t('Install app', 'تثبيت التطبيق')}</span>
            </button>
            {showFallbackHint && (
              <p className="text-center text-xs text-emerald-100">
                {isDesktop
                  ? t('Use your browser menu to install this app (e.g. address bar install icon).', 'استخدم قائمة المتصفح لتثبيت التطبيق (مثل أيقونة التثبيت في شريط العنوان).')
                  : t('Open browser menu (⋮) and choose Install app / Add to Home screen.', 'افتح قائمة المتصفح (⋮) واختر تثبيت التطبيق / إضافة إلى الشاشة الرئيسية.')}
              </p>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-white/20 pt-2">
          <button
            type="button"
            onClick={() => dismissInstallModal(DISMISS_HOURS_EXTENDED)}
            className="text-xs text-emerald-100 underline underline-offset-2 hover:text-white"
          >
            {t("Don't show for 7 days", 'عدم الإظهار لمدة 7 أيام')}
          </button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => dismissInstallModal(DISMISS_HOURS_DEFAULT)}
            className="border-white/30 bg-white/15 text-white hover:bg-white/25 hover:text-white"
          >
            {t('Not now', 'لاحقاً')}
          </Button>
        </div>
      </div>
    </div>
  )
}
