'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/LanguageContext'
import { useToast } from '@/components/ui/ToastProvider'
import {
  AUTO_DELIVERY_DROPDOWN_SEQUENCE,
  initialAutoDeliveryMinutesFromTenant,
} from '@/lib/auto-delivery-request'

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
      className={`rounded-2xl border border-blue-200 bg-blue-50/90 p-3 shadow-sm dark:border-blue-800 dark:bg-blue-950/50 ${className}`}
      animate={
        pulse
          ? { boxShadow: ['0 0 0 0 rgba(37, 99, 235, 0)', '0 0 0 6px rgba(37, 99, 235, 0.12)'] }
          : { boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
      }
      transition={pulse ? { repeat: Infinity, duration: 2, ease: [0.2, 0, 0, 1] } : { duration: 0.2 }}
    >
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-800 dark:text-blue-200">
        {t('Auto request drivers after', 'طلب السائقين تلقائياً بعد')}
      </p>
      <select
        value={selectKey}
        disabled={disabled || busy}
        onChange={(e) => onSelectChange(e.target.value)}
        className="mb-2 w-full rounded-xl border-2 border-blue-200 bg-white px-3 py-2.5 text-sm font-semibold text-blue-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-100"
      >
        {AUTO_DELIVERY_DROPDOWN_SEQUENCE.map((entry) => (
          <option key={entry === 'none' ? 'none' : entry} value={entry === 'none' ? 'none' : String(entry)}>
            {optionLabel(entry, t)}
          </option>
        ))}
      </select>

      <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs font-medium text-blue-900/90 dark:text-blue-100/90">
        <input
          type="checkbox"
          checked={savePref}
          disabled={disabled || busy}
          onChange={(e) => onSavePrefToggle(e.target.checked)}
          className="size-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
        />
        {t('Save my choice for future orders', 'احفظ اختياري للطلبات القادمة')}
      </label>

      {remainingMin !== null && remainingMin > 0 && (
        <p className="mb-2 text-xs font-bold text-blue-700 dark:text-blue-300">
          {t(`Drivers in ~${remainingMin} min`, `السائقون خلال ~${remainingMin} د`)}
        </p>
      )}

      {showStopCountdown && autoDeliveryRequestScheduledAt && !deliveryRequestedAt && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          className="w-full border-blue-300 bg-white text-blue-800 hover:bg-blue-100 dark:border-blue-700 dark:bg-slate-800 dark:text-blue-100 dark:hover:bg-slate-700"
          onClick={() => {
            setSelectKey('none')
            void commit(null, false)
          }}
        >
          {t('Stop countdown', 'إيقاف العد')}
        </Button>
      )}
    </motion.div>
  )
}
