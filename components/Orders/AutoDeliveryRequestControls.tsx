'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'
import { useToast } from '@/components/ui/ToastProvider'
import { cn } from '@/lib/utils'
import {
  AUTO_DELIVERY_DROPDOWN_SEQUENCE,
  initialAutoDeliveryMinutesFromTenant,
} from '@/lib/auto-delivery-request'

/** M3 + brand: surface container, outline, compact 8dp rhythm — shared with OrderNotifications */
export const autoDeliveryM3 = {
  surface:
    'rounded-2xl border border-[color:var(--m3-outline-variant)] bg-[color:var(--m3-primary-container)] p-2 shadow-[var(--m3-elevation-1)] dark:border-slate-600 dark:bg-slate-800 dark:shadow-md',
  label:
    'text-[11px] font-medium leading-4 text-[color:var(--m3-on-primary-container)] dark:text-slate-300',
  select:
    'h-9 w-full rounded-xl border border-[color:var(--m3-outline)] bg-[color:var(--m3-surface-container-high)] px-3 text-sm font-medium text-[color:var(--m3-on-surface)] shadow-sm outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50',
  checkboxRow:
    'flex cursor-pointer items-start gap-2 text-[11px] leading-snug font-medium text-[color:var(--m3-on-surface)] dark:text-slate-200',
  checkbox:
    'mt-0.5 size-3.5 shrink-0 rounded border-[color:var(--m3-outline)] text-amber-600 accent-amber-600 focus:ring-2 focus:ring-amber-500/30 dark:border-slate-500 dark:bg-slate-900',
  countdown:
    'inline-flex max-w-full items-center gap-1.5 rounded-full bg-amber-100/90 px-2 py-0.5 text-[11px] font-semibold text-amber-950 dark:bg-amber-950/60 dark:text-amber-100',
  stopBtn:
    'h-8 w-full rounded-xl border border-[color:var(--m3-outline)] bg-[color:var(--m3-surface-container-high)] text-xs font-medium text-[color:var(--m3-on-surface)] shadow-sm hover:bg-[color:var(--m3-surface-container)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-700',
} as const

export type AutoDeliveryDefaults = {
  defaultAutoDeliveryRequestMinutes?: number | null
  saveAutoDeliveryRequestPreference?: boolean
}

function keyToMinutes(k: string): number | null {
  if (k === 'none') return null
  const n = Number(k)
  return Number.isFinite(n) ? n : 20
}

function minutesToKey(m: number | null): string {
  return m === null ? 'none' : String(m)
}

function optionLabel(
  entry: number | 'none',
  t: (en: string, ar: string) => string
): string {
  if (entry === 'none') return t('None (manual only)', 'بدون (يدوي فقط)')
  if (entry === 0) return t('Immediately', 'فوراً')
  return t(`${entry} minutes`, `${entry} دقيقة`)
}

export function AutoDeliveryRequestControls({
  tenantSlug,
  orderId,
  deliveryRequestedAt,
  autoDeliveryRequestMinutes,
  autoDeliveryRequestScheduledAt,
  tenantDefaults,
  disabled,
  emphasize,
  className = '',
  onPatched,
  showStopCountdown = true,
}: {
  tenantSlug: string
  orderId: string
  deliveryRequestedAt?: string | null
  autoDeliveryRequestMinutes?: number | null
  autoDeliveryRequestScheduledAt?: string | null
  tenantDefaults?: AutoDeliveryDefaults
  disabled?: boolean
  /** Pulse highlight for new / attention */
  emphasize?: boolean
  className?: string
  onPatched?: (partial: {
    deliveryRequestedAt?: string | null
    autoDeliveryRequestMinutes?: number | null
    autoDeliveryRequestScheduledAt?: string | null
    autoDeliveryRequestTriggeredAt?: string | null
  }) => void
  showStopCountdown?: boolean
}) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [selectKey, setSelectKey] = useState<string>(() => {
    if (autoDeliveryRequestScheduledAt && autoDeliveryRequestMinutes != null) {
      return minutesToKey(autoDeliveryRequestMinutes)
    }
    return minutesToKey(initialAutoDeliveryMinutesFromTenant(tenantDefaults ?? {}))
  })
  const [savePref, setSavePref] = useState(false)
  const [busy, setBusy] = useState(false)
  const [nowTick, setNowTick] = useState(0)

  useEffect(() => {
    if (autoDeliveryRequestScheduledAt && autoDeliveryRequestMinutes != null) {
      setSelectKey(minutesToKey(autoDeliveryRequestMinutes))
    } else if (!deliveryRequestedAt) {
      setSelectKey(minutesToKey(initialAutoDeliveryMinutesFromTenant(tenantDefaults ?? {})))
    }
    setSavePref(false)
  }, [
    orderId,
    autoDeliveryRequestScheduledAt,
    autoDeliveryRequestMinutes,
    deliveryRequestedAt,
    tenantDefaults?.saveAutoDeliveryRequestPreference,
    tenantDefaults?.defaultAutoDeliveryRequestMinutes,
  ])

  useEffect(() => {
    if (!autoDeliveryRequestScheduledAt || deliveryRequestedAt) return
    const id = setInterval(() => setNowTick((x) => x + 1), 15000)
    return () => clearInterval(id)
  }, [autoDeliveryRequestScheduledAt, deliveryRequestedAt])

  const commit = useCallback(
    async (next: number | null, persistPref: boolean) => {
      setBusy(true)
      try {
        const res = await fetch(
          `/api/tenants/${encodeURIComponent(tenantSlug)}/orders/${encodeURIComponent(orderId)}/auto-delivery-request`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minutes: next, savePreference: persistPref }),
          }
        )
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          firedImmediately?: boolean
          autoDeliveryRequestMinutes?: number | null
          autoDeliveryRequestScheduledAt?: string | null
        }
        if (!res.ok) throw new Error(data.error || 'Request failed')

        if (data.firedImmediately) {
          showToast(
            t('Delivery requested!', 'تم طلب التوصيل!'),
            t('Drivers have been notified.', 'تم إشعار السائقين.'),
            'success'
          )
          onPatched?.({
            deliveryRequestedAt: new Date().toISOString(),
            autoDeliveryRequestMinutes: next,
            autoDeliveryRequestScheduledAt: null,
            autoDeliveryRequestTriggeredAt: new Date().toISOString(),
          })
          return
        }

        onPatched?.({
          autoDeliveryRequestMinutes: data.autoDeliveryRequestMinutes ?? next,
          autoDeliveryRequestScheduledAt: data.autoDeliveryRequestScheduledAt ?? null,
        })
      } catch (e) {
        console.error(e)
        showToast(
          t('Could not update auto-delivery', 'تعذّر تحديث الطلب التلقائي'),
          (e as Error).message,
          'error'
        )
      } finally {
        setBusy(false)
      }
    },
    [tenantSlug, orderId, onPatched, showToast, t]
  )

  const onSelectChange = (k: string) => {
    setSelectKey(k)
    void commit(keyToMinutes(k), savePref)
  }

  const onSavePrefToggle = (checked: boolean) => {
    setSavePref(checked)
    void commit(keyToMinutes(selectKey), checked)
  }

  let remainingMin: number | null = null
  if (autoDeliveryRequestScheduledAt && !deliveryRequestedAt) {
    const ms = new Date(autoDeliveryRequestScheduledAt).getTime() - Date.now()
    remainingMin = Math.max(0, Math.ceil(ms / 60_000))
  }
  void nowTick

  /** Pulse only when a timed/immediate auto-request is chosen—not for “None”, and not after a schedule is committed. */
  const pulse =
    emphasize &&
    !deliveryRequestedAt &&
    !autoDeliveryRequestScheduledAt &&
    selectKey !== 'none'

  return (
    <motion.div
      className={cn(autoDeliveryM3.surface, 'space-y-2', className)}
      animate={
        pulse
          ? {
              boxShadow: [
                'var(--m3-elevation-1)',
                '0 0 0 3px color-mix(in oklab, var(--m3-primary) 22%, transparent)',
              ],
            }
          : { boxShadow: 'var(--m3-elevation-1)' }
      }
      transition={pulse ? { repeat: Infinity, duration: 2, ease: [0.2, 0, 0, 1] } : { duration: 0.2 }}
    >
      <div className="flex items-start gap-2">
        <div
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
          aria-hidden
        >
          <Timer className="size-3.5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className={autoDeliveryM3.label}>
            {t('Auto request drivers after', 'طلب السائقين تلقائياً بعد')}
          </p>
          <select
            value={selectKey}
            disabled={disabled || busy}
            onChange={(e) => onSelectChange(e.target.value)}
            className={autoDeliveryM3.select}
          >
            {AUTO_DELIVERY_DROPDOWN_SEQUENCE.map((entry) => (
              <option key={entry === 'none' ? 'none' : entry} value={entry === 'none' ? 'none' : String(entry)}>
                {optionLabel(entry, t)}
              </option>
            ))}
          </select>

          <label className={autoDeliveryM3.checkboxRow}>
            <input
              type="checkbox"
              checked={savePref}
              disabled={disabled || busy}
              onChange={(e) => onSavePrefToggle(e.target.checked)}
              className={autoDeliveryM3.checkbox}
            />
            <span>{t('Save my choice for future orders', 'احفظ اختياري للطلبات القادمة')}</span>
          </label>

          {remainingMin !== null && remainingMin > 0 && (
            <p className={autoDeliveryM3.countdown} role="status">
              {t(`Drivers in ~${remainingMin} min`, `السائقون خلال ~${remainingMin} د`)}
            </p>
          )}

          {showStopCountdown && autoDeliveryRequestScheduledAt && !deliveryRequestedAt && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || busy}
              className={cn(autoDeliveryM3.stopBtn, 'mt-0.5')}
              onClick={() => {
                setSelectKey('none')
                void commit(null, false)
              }}
            >
              {t('Stop countdown', 'إيقاف العد')}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
