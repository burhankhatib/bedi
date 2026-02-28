'use client'

import { useEffect, useState, useCallback } from 'react'
import { Download, X, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'bedi-orders-pwa-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/**
 * Registers the per-business Orders PWA SW and shows a native install banner.
 * On Android Chrome: captures beforeinstallprompt and shows a bottom banner.
 * On iOS Safari (non-standalone): shows Share → Add to Home Screen instructions.
 * Already-installed (standalone) users see nothing.
 */
export function OrdersPWASetup({ slug }: { slug: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [showIOSBanner, setShowIOSBanner] = useState(false)
  const [installing, setInstalling] = useState(false)

  // Register SW
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !slug) return
    try {
      const scope = `/t/${slug}/orders`
      navigator.serviceWorker.register(`/t/${slug}/orders/sw.js`, { scope }).catch(() => {})
    } catch {
      // avoid uncaught errors
    }
  }, [slug])

  // Capture native install prompt (Android/Desktop)
  useEffect(() => {
    if (isStandalone()) return
    const dismissed = (() => { try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false } })()
    if (dismissed) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // iOS Safari: show manual instructions when not standalone
  useEffect(() => {
    if (isStandalone()) return
    if (!isIOS()) return
    const dismissed = (() => { try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false } })()
    if (dismissed) return
    setShowIOSBanner(true)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowBanner(false)
        setDeferredPrompt(null)
      }
    } finally {
      setInstalling(false)
    }
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
    setShowBanner(false)
    setShowIOSBanner(false)
    setDeferredPrompt(null)
  }, [])

  if (!showBanner && !showIOSBanner) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-amber-500/30 bg-slate-900/95 px-4 pb-safe-area-inset-bottom shadow-2xl backdrop-blur-md"
      role="region"
      aria-label="Install app / تثبيت التطبيق"
    >
      <div className="mx-auto max-w-2xl py-4">
        {/* Header row */}
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
            <Smartphone className="h-5 w-5 text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white">
              Install this business app&nbsp;·&nbsp;ثبّت تطبيق هذا المتجر
            </p>
            <p className="mt-0.5 text-sm text-slate-400">
              Receive instant order alerts even when this page is closed
              &nbsp;·&nbsp;
              استلم تنبيهات الطلبات فوراً حتى عند إغلاق الصفحة
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss / إغلاق"
            className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Why install bullets */}
        <ul className="mb-4 space-y-1 text-xs text-slate-400">
          <li>✓ FCM push notifications for new orders &amp; status changes · إشعارات فورية للطلبات الجديدة وتغييرات الحالة</li>
          <li>✓ Your business logo &amp; name on the Home Screen · شعار ومسمى متجرك على الشاشة الرئيسية</li>
          <li>✓ Each business installs as a separate app · كل متجر كتطبيق مستقل منفصل</li>
          <li>✓ Works when your screen is off · يعمل عند إغلاق الشاشة</li>
        </ul>

        {showBanner && deferredPrompt && (
          <Button
            onClick={handleInstall}
            disabled={installing}
            className="w-full gap-2 bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400"
            size="lg"
          >
            <Download className="h-5 w-5 shrink-0" />
            {installing
              ? 'Installing… · جاري التثبيت…'
              : 'Install App · تثبيت التطبيق'}
          </Button>
        )}

        {showIOSBanner && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/40 p-3 text-sm text-amber-200">
            <p className="font-medium mb-1">
              iPhone / iPad — افتح في Safari واضغط:
            </p>
            <p>
              Tap the <strong>Share</strong> button (□↑) → <strong>Add to Home Screen</strong> → <strong>Add</strong>
            </p>
            <p className="mt-1 text-amber-300/80">
              اضغط زر <strong>المشاركة</strong> (□↑) ← <strong>إضافة إلى الشاشة الرئيسية</strong> ← <strong>إضافة</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
