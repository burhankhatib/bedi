'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'

type Props = {
  /** Service worker script URL (e.g. /app-sw.js or /driver-sw.js) */
  scriptUrl: string
  /** Registration scope (e.g. / or /driver/) */
  scope: string
  /** Title (English) */
  titleEn?: string
  /** Title (Arabic) */
  titleAr?: string
  /** Reload button (English) */
  reloadEn?: string
  /** Reload button (Arabic) */
  reloadAr?: string
  /** RTL for the banner (e.g. true for driver) */
  rtl?: boolean
}

const DEFAULT_TITLE_EN = 'A new version is available'
const DEFAULT_TITLE_AR = 'يتوفر إصدار جديد'
const DEFAULT_RELOAD_EN = 'Reload to update'
const DEFAULT_RELOAD_AR = 'تحديث الآن'

const STORAGE_KEY_PREFIX = 'pwa-update-shown-'
const RELOAD_PENDING_PREFIX = 'pwa-reload-pending-'
const RELOAD_PENDING_MAX_AGE_MS = 45 * 1000

/** Return a stable key for "we already showed the prompt for this waiting worker" so we don't loop. */
function getShownKey(scope: string, waitingScriptUrl: string | undefined): string {
  return `${STORAGE_KEY_PREFIX}${scope.replace(/\//g, '_')}-${(waitingScriptUrl || '').slice(-32)}`
}

function getReloadPendingKey(scope: string): string {
  return `${RELOAD_PENDING_PREFIX}${scope.replace(/\//g, '_')}`
}

/** True if we just reloaded to apply an update; don't show the banner again this load. */
function isReloadPending(scope: string): boolean {
  if (typeof sessionStorage === 'undefined') return false
  try {
    const key = getReloadPendingKey(scope)
    const raw = sessionStorage.getItem(key)
    if (!raw) return false
    const at = parseInt(raw, 10)
    if (Number.isNaN(at) || Date.now() - at > RELOAD_PENDING_MAX_AGE_MS) return false
    return true
  } catch {
    return false
  }
}

function setReloadPending(scope: string): void {
  try {
    sessionStorage.setItem(getReloadPendingKey(scope), String(Date.now()))
  } catch {
    // ignore
  }
}

function clearReloadPending(scope: string): void {
  try {
    sessionStorage.removeItem(getReloadPendingKey(scope))
  } catch {
    // ignore
  }
}

function wasAlreadyShown(scope: string, reg: ServiceWorkerRegistration): boolean {
  if (typeof sessionStorage === 'undefined') return false
  const key = getShownKey(scope, reg.waiting?.scriptURL)
  return sessionStorage.getItem(key) === '1'
}

function markShown(scope: string, reg: ServiceWorkerRegistration): void {
  try {
    const key = getShownKey(scope, reg.waiting?.scriptURL)
    sessionStorage.setItem(key, '1')
  } catch {
    // ignore
  }
}

export function PWAUpdatePrompt({
  scriptUrl,
  scope,
  titleEn = DEFAULT_TITLE_EN,
  titleAr = DEFAULT_TITLE_AR,
  reloadEn = DEFAULT_RELOAD_EN,
  reloadAr = DEFAULT_RELOAD_AR,
  rtl = false,
}: Props) {
  const { lang } = useLanguage()
  const isAr = rtl || lang === 'ar'
  const [show, setShow] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [mounted, setMounted] = useState(false)
  const updateCheckRef = useRef(false)
  const reloadDoneRef = useRef(false)

  const checkWaiting = useCallback((reg: ServiceWorkerRegistration) => {
    if (!reg.waiting) return
    if (isReloadPending(scope)) {
      clearReloadPending(scope)
      return
    }
    if (wasAlreadyShown(scope, reg)) return
    markShown(scope, reg)
    setRegistration(reg)
    setShow(true)
  }, [scope])

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    setMounted(true)

    const doUpdate = () => {
      if (updateCheckRef.current) return
      try {
        navigator.serviceWorker.getRegistration(scope).then((reg) => {
          if (reg) {
            reg.update().catch(() => {})
            if (reg.waiting && !isReloadPending(scope) && !wasAlreadyShown(scope, reg)) {
              markShown(scope, reg)
              setRegistration(reg)
              setShow(true)
            } else if (reg.waiting && isReloadPending(scope)) {
              clearReloadPending(scope)
            }
          }
        }).catch(() => {})
      } catch {
        // avoid uncaught errors in PWA update flow
      }
    }

    const attachUpdateFound = (existing: ServiceWorkerRegistration) => {
      try {
        existing.addEventListener('updatefound', () => {
          const newWorker = existing.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller && existing.waiting) {
              if (isReloadPending(scope)) {
                clearReloadPending(scope)
                return
              }
              if (wasAlreadyShown(scope, existing)) return
              markShown(scope, existing)
              setRegistration(existing)
              setShow(true)
            }
          })
        })
      } catch {
        // avoid breaking the page if SW events fail
      }
    }

    navigator.serviceWorker.getRegistration(scope).then((existing) => {
      if (existing) {
        if (existing.waiting) {
          if (isReloadPending(scope)) {
            clearReloadPending(scope)
          } else if (!wasAlreadyShown(scope, existing)) {
            markShown(scope, existing)
            setRegistration(existing)
            setShow(true)
          }
        }
        doUpdate()
        attachUpdateFound(existing)
        return
      }
      navigator.serviceWorker.register(scriptUrl, { scope }).then((r) => {
        if (r.waiting) {
          if (isReloadPending(scope)) {
            clearReloadPending(scope)
          } else if (!wasAlreadyShown(scope, r)) {
            markShown(scope, r)
            setRegistration(r)
            setShow(true)
          }
        }
        r.update().catch(() => {})
        attachUpdateFound(r)
      }).catch(() => {})
    }).catch(() => {})

    const onFocus = () => {
      updateCheckRef.current = false
      doUpdate()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateCheckRef.current = false
        doUpdate()
      }
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    const intervalMs = 60 * 1000
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') doUpdate()
    }, intervalMs)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval(interval)
    }
  }, [scope, scriptUrl, checkWaiting])

  useEffect(() => {
    if (!show || !registration?.waiting) return
    const onControllerChange = () => {
      if (reloadDoneRef.current) return
      reloadDoneRef.current = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
  }, [show, registration])

  const handleReload = useCallback(() => {
    setReloadPending(scope)
    setShow(false)

    const doReload = () => {
      if (reloadDoneRef.current) return
      reloadDoneRef.current = true
      window.location.reload()
    }

    const FALLBACK_RELOAD_MS = 1200
    try {
      const tellWaitingToActivate = (reg: ServiceWorkerRegistration | null) => {
        if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
      if (registration?.waiting) {
        tellWaitingToActivate(registration)
        setTimeout(doReload, FALLBACK_RELOAD_MS)
      } else {
        navigator.serviceWorker.getRegistration(scope).then((reg) => {
          tellWaitingToActivate(reg ?? null)
          setTimeout(doReload, FALLBACK_RELOAD_MS)
        }).catch(doReload)
      }
    } catch {
      doReload()
    }
  }, [scope, registration])

  if (!mounted || !show) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.25 }}
        className="fixed left-0 right-0 top-[calc(env(safe-area-inset-top,0px)+4.5rem)] z-[50]"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="mx-auto max-w-[100vw] px-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:max-w-lg sm:px-4">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/95 to-slate-900/98 px-4 py-3 shadow-lg shadow-emerald-900/20 backdrop-blur">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
              <Sparkles className="size-5 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">
                {isAr ? titleAr : titleEn}
              </p>
              <p className="mt-0.5 text-sm text-slate-300">
                {isAr
                  ? 'اضغط لتحديث التطبيق والحصول على آخر التحديثات.'
                  : 'Tap below to reload and get the latest version.'}
              </p>
            </div>
            <Button
              onClick={handleReload}
              size="sm"
              className="shrink-0 gap-1.5 bg-emerald-500 font-medium text-slate-950 hover:bg-emerald-400"
            >
              <RefreshCw className="size-4" />
              {isAr ? reloadAr : reloadEn}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
