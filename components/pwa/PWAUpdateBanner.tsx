'use client'

/**
 * PWA Update Banner – Unified Component
 * Shows a banner when a new SW version is available, prompting the user to reload.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'
import type { PWAConfig } from '@/lib/pwa/types'

const STORAGE_KEY_PREFIX = 'pwa-update-shown-'
const RELOAD_PENDING_PREFIX = 'pwa-reload-pending-'
const RELOAD_PENDING_MAX_AGE_MS = 45 * 1000

function getShownKey(scope: string, waitingScriptUrl: string | undefined): string {
  return `${STORAGE_KEY_PREFIX}${scope.replace(/\//g, '_')}-${(waitingScriptUrl || '').slice(-32)}`
}

function getReloadPendingKey(scope: string): string {
  return `${RELOAD_PENDING_PREFIX}${scope.replace(/\//g, '_')}`
}

function isReloadPending(scope: string): boolean {
  if (typeof sessionStorage === 'undefined') return false
  try {
    const raw = sessionStorage.getItem(getReloadPendingKey(scope))
    if (!raw) return false
    const at = parseInt(raw, 10)
    return !Number.isNaN(at) && Date.now() - at <= RELOAD_PENDING_MAX_AGE_MS
  } catch { return false }
}

function setReloadPending(scope: string): void {
  try { sessionStorage.setItem(getReloadPendingKey(scope), String(Date.now())) } catch {}
}

function clearReloadPending(scope: string): void {
  try { sessionStorage.removeItem(getReloadPendingKey(scope)) } catch {}
}

function wasAlreadyShown(scope: string, reg: ServiceWorkerRegistration): boolean {
  if (typeof sessionStorage === 'undefined') return false
  return sessionStorage.getItem(getShownKey(scope, reg.waiting?.scriptURL)) === '1'
}

function markShown(scope: string, reg: ServiceWorkerRegistration): void {
  try { sessionStorage.setItem(getShownKey(scope, reg.waiting?.scriptURL), '1') } catch {}
}

interface PWAUpdateBannerProps {
  config: PWAConfig
  registration: ServiceWorkerRegistration | null
}

const UPDATE_CHECK_INTERVAL_MS = 30 * 1000 // 30s — aggressive check for new code deployments
const RELOAD_FALLBACK_MS = 1500 // Max wait for controllerchange before forcing reload

export function PWAUpdateBanner({ config, registration: externalReg }: PWAUpdateBannerProps) {
  const { lang } = useLanguage()
  const isAr = lang === 'ar'
  const [show, setShow] = useState(false)
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null)
  const [mounted, setMounted] = useState(false)
  const [reloading, setReloading] = useState(false)
  const reloadDoneRef = useRef(false)

  const scope = config.scope

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    setMounted(true)

    const checkReg = (r: ServiceWorkerRegistration) => {
      if (!r.waiting) return
      if (isReloadPending(scope)) { clearReloadPending(scope); return }
      if (wasAlreadyShown(scope, r)) return
      markShown(scope, r)
      setReg(r)
      setShow(true)
    }

    const attachUpdateFound = (r: ServiceWorkerRegistration) => {
      try {
        r.addEventListener('updatefound', () => {
          const newWorker = r.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller && r.waiting) {
              if (isReloadPending(scope)) { clearReloadPending(scope); return }
              if (wasAlreadyShown(scope, r)) return
              markShown(scope, r)
              setReg(r)
              setShow(true)
            }
          })
        })
      } catch {}
    }

    // Use external registration or look one up. Always run reg.update() to detect new deployments.
    const doCheck = async () => {
      const existing = externalReg ?? (await navigator.serviceWorker.getRegistration(scope))
      if (existing) {
        if (existing.waiting) checkReg(existing)
        existing.update().catch(() => {})
        attachUpdateFound(existing)
      }
    }
    doCheck()
    // Delayed check: catches updates when user opens app shortly after deploy
    const delayedCheck = setTimeout(doCheck, 2500)

    const onFocus = () => doCheck()
    const onVisibility = () => { if (document.visibilityState === 'visible') doCheck() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    const interval = setInterval(() => { if (document.visibilityState === 'visible') doCheck() }, UPDATE_CHECK_INTERVAL_MS)

    return () => {
      clearTimeout(delayedCheck)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(interval)
    }
  }, [scope, externalReg])

  // Listen for controller change to auto-reload
  useEffect(() => {
    if (!show || !reg?.waiting) return
    const onChange = () => {
      if (reloadDoneRef.current) return
      reloadDoneRef.current = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange)
  }, [show, reg])

  const handleReload = useCallback(() => {
    if (reloadDoneRef.current) return
    setReloadPending(scope)
    setReloading(true)

    const doReload = () => {
      if (reloadDoneRef.current) return
      reloadDoneRef.current = true
      window.location.reload()
    }

    try {
      const tellWaiting = (r: ServiceWorkerRegistration | null) => {
        if (r?.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
      if (reg?.waiting) {
        tellWaiting(reg)
        setTimeout(doReload, RELOAD_FALLBACK_MS)
      } else {
        navigator.serviceWorker.getRegistration(scope).then((r) => {
          tellWaiting(r ?? null)
          setTimeout(doReload, RELOAD_FALLBACK_MS)
        }).catch(doReload)
      }
    } catch {
      doReload()
    }
  }, [scope, reg])

  if (!mounted || !show) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.25 }}
        className="fixed left-0 right-0 top-[4.5rem] z-[50] safe-area-inset-top"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="mx-auto max-w-[100vw] px-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:max-w-lg sm:px-4">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/95 to-slate-900/98 px-4 py-3 shadow-lg shadow-emerald-900/20 backdrop-blur">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
              <Sparkles className="size-5 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">
                {isAr ? 'يتوفر إصدار جديد' : 'A new version is available'}
              </p>
              <p className="mt-0.5 text-sm text-slate-300">
                {isAr
                  ? 'اضغط لتحديث التطبيق والحصول على آخر التحديثات.'
                  : 'Tap below to reload and get the latest version.'}
              </p>
            </div>
            <Button
              type="button"
              onClick={handleReload}
              disabled={reloading}
              size="sm"
              className="shrink-0 gap-1.5 bg-emerald-500 font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-90 disabled:cursor-wait"
            >
              <RefreshCw className={`size-4 ${reloading ? 'animate-spin' : ''}`} />
              {reloading
                ? (isAr ? 'جاري التحديث...' : 'Reloading...')
                : (isAr ? 'تحديث الآن' : 'Reload to update')}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
