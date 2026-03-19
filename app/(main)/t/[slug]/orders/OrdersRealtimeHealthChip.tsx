'use client'

import { useCallback, useEffect, useState } from 'react'
import { Activity, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'

type RealtimeHealth = {
  ok: boolean
  checkedAt?: string
  pusher?: {
    configured?: boolean
    triggerOk?: boolean
    missingEnvKeys?: string[]
  }
  error?: string
}

type ChipState = 'loading' | 'healthy' | 'degraded' | 'error'

/** Sanity is never touched — only Clerk session + Pusher test trigger + env reads. */
const AUTO_REFRESH_MS = 60_000

function deriveState(health: RealtimeHealth | null, loading: boolean): ChipState {
  if (loading) return 'loading'
  if (!health) return 'error'
  if (health.ok) return 'healthy'
  if (health.error) return 'error'
  return 'degraded'
}

export function OrdersRealtimeHealthChip() {
  const [loading, setLoading] = useState(false)
  const [health, setHealth] = useState<RealtimeHealth | null>(null)

  const runCheck = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/health/realtime', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        const message = typeof data.error === 'string' ? data.error : 'Realtime check failed'
        setHealth({ ok: false, error: message })
        return
      }
      setHealth({
        ok: Boolean(data.ok),
        checkedAt: typeof data.checkedAt === 'string' ? data.checkedAt : undefined,
        pusher: typeof data.pusher === 'object' && data.pusher ? (data.pusher as RealtimeHealth['pusher']) : undefined,
      })
    } catch {
      setHealth({ ok: false, error: 'Network error' })
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void runCheck()
  }, [runCheck])

  // Auto-refresh while tab is visible only (no Sanity; Clerk + Pusher only).
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null

    const stop = () => {
      if (intervalId != null) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const start = () => {
      stop()
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
      intervalId = setInterval(() => {
        void runCheck({ silent: true })
      }, AUTO_REFRESH_MS)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void runCheck({ silent: true })
        start()
      } else {
        stop()
      }
    }

    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [runCheck])

  const state = deriveState(health, loading)

  const chipClass =
    state === 'healthy'
      ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
      : state === 'degraded'
        ? 'border-amber-500/35 bg-amber-500/10 text-amber-300'
        : state === 'loading'
          ? 'border-sky-500/35 bg-sky-500/10 text-sky-300'
          : 'border-rose-500/35 bg-rose-500/10 text-rose-300'

  const label =
    state === 'healthy'
      ? 'Realtime healthy'
      : state === 'degraded'
        ? 'Realtime degraded'
        : state === 'loading'
          ? 'Checking realtime...'
          : 'Realtime unavailable'

  const details = health?.pusher?.configured === false
    ? `Missing: ${(health.pusher.missingEnvKeys ?? []).join(', ')}`
    : health?.error ?? null

  const chipTitle = [
    details,
    health?.checkedAt ? `Last check: ${new Date(health.checkedAt).toLocaleTimeString()}` : null,
    'Auto every 60s while tab is visible. Does not call Sanity.',
  ]
    .filter((x): x is string => Boolean(x))
    .join(' · ')

  return (
    <div className="flex items-center gap-2" title={chipTitle || undefined}>
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${chipClass}`}
        >
          {state === 'healthy' ? (
            <CheckCircle2 className="size-3.5" />
          ) : state === 'degraded' || state === 'error' ? (
            <AlertTriangle className="size-3.5" />
          ) : (
            <Activity className="size-3.5 animate-pulse" />
          )}
          <span>{label}</span>
        </motion.div>
      </AnimatePresence>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => void runCheck()}
        disabled={loading}
        className="h-7 rounded-full border border-slate-700/60 bg-slate-900/60 px-2 text-slate-300 hover:bg-slate-800 hover:text-white"
        title="Recheck realtime health"
      >
        <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  )
}
