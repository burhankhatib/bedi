'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@/components/LanguageContext'
import { useToast } from '@/components/ui/ToastProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Wallet } from 'lucide-react'

type PayrollRow = {
  payrollDocId?: string
  staffId: string
  email: string
  displayName?: string
  sessionsCount: number
  regularMinutes: number
  overtimeMinutes: number
  regularHours: number
  overtimeHours: number
  hourlyRate: number
  overtimeMultiplier: number
  grossPay: number
  adjustments: number
  netPay: number
  status: 'draft' | 'approved' | 'paid'
  notes?: string
}

type PayrollResponse = {
  success: boolean
  period: { from: string; to: string }
  rows: PayrollRow[]
  totals: {
    regularMinutes: number
    overtimeMinutes: number
    regularHours: number
    overtimeHours: number
    grossPay: number
    netPay: number
  }
}

type PayrollEdit = {
  adjustments: string
  notes: string
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }
}

export function PayrollManageClient({ slug }: { slug: string }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const def = currentMonthRange()
  const [from, setFrom] = useState(def.from)
  const [to, setTo] = useState(def.to)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<'approve' | 'paid' | null>(null)
  const [data, setData] = useState<PayrollResponse | null>(null)
  const [edits, setEdits] = useState<Record<string, PayrollEdit>>({})

  const api = useCallback(
    (f: string, tEnd: string) =>
      fetch(`/api/tenants/${slug}/payroll?from=${encodeURIComponent(f)}&to=${encodeURIComponent(tEnd)}`, {
        credentials: 'include',
      }),
    [slug]
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString()
      const toIso = new Date(`${to}T00:00:00.000Z`).toISOString()
      const res = await api(fromIso, toIso)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(
          json?.error || 'Failed to load payroll',
          json?.error || 'فشل تحميل الرواتب',
          'error'
        )
        setData(null)
        return
      }
      const parsed = json as PayrollResponse
      setData(parsed)
      setEdits(
        Object.fromEntries(
          (parsed.rows || []).map((r) => [
            r.staffId,
            {
              adjustments: String(Number.isFinite(r.adjustments) ? r.adjustments : 0),
              notes: r.notes || '',
            },
          ])
        )
      )
    } finally {
      setLoading(false)
    }
  }, [api, from, to, showToast])

  useEffect(() => {
    load().catch(() => {})
  }, [load])

  const rows = useMemo(() => data?.rows ?? [], [data])
  const computedNetTotal = useMemo(
    () =>
      rows
        .reduce((acc, r) => {
          const raw = edits[r.staffId]?.adjustments ?? String(r.adjustments || 0)
          const n = Number(raw)
          const adj = Number.isFinite(n) ? n : 0
          return Number((acc + r.grossPay + adj).toFixed(2))
        }, 0)
        .toFixed(2),
    [rows, edits]
  )

  const saveDraft = useCallback(async () => {
    setSaving(true)
    try {
      const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString()
      const toIso = new Date(`${to}T00:00:00.000Z`).toISOString()
      const payload = {
        from: fromIso,
        to: toIso,
        edits: rows.map((r) => {
          const raw = edits[r.staffId]
          const adjustments = Number(raw?.adjustments ?? r.adjustments ?? 0)
          return {
            staffId: r.staffId,
            adjustments: Number.isFinite(adjustments) ? adjustments : 0,
            notes: raw?.notes || '',
          }
        }),
      }
      const res = await fetch(`/api/tenants/${slug}/payroll`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(json?.error || 'Failed to save payroll draft', json?.error || 'فشل حفظ مسودة الرواتب', 'error')
        return
      }
      showToast('Payroll draft saved', 'تم حفظ مسودة الرواتب', 'success')
      await load()
    } finally {
      setSaving(false)
    }
  }, [edits, from, load, rows, showToast, slug, to])

  const runStatusAction = useCallback(
    async (action: 'approve_all' | 'paid_all') => {
      setUpdatingStatus(action === 'approve_all' ? 'approve' : 'paid')
      try {
        const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString()
        const toIso = new Date(`${to}T00:00:00.000Z`).toISOString()
        const res = await fetch(`/api/tenants/${slug}/payroll`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, from: fromIso, to: toIso }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast(json?.error || 'Failed to update payroll status', json?.error || 'فشل تحديث حالة الرواتب', 'error')
          return
        }
        showToast(
          action === 'approve_all' ? 'Payroll approved' : 'Payroll marked as paid',
          action === 'approve_all' ? 'تم اعتماد الرواتب' : 'تم وسم الرواتب كمدفوعة',
          'success'
        )
        await load()
      } finally {
        setUpdatingStatus(null)
      }
    },
    [from, load, showToast, slug, to]
  )

  return (
    <div className="mt-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Wallet className="size-6" />
          {t('Payroll', 'الرواتب')}
        </h1>
        <p className="mt-1 text-slate-400">
          {t(
            'Payroll is calculated from attendance sessions + hourly rates. Overtime starts after 8 hours/day.',
            'يتم احتساب الرواتب من جلسات الحضور + الأجر بالساعة. يبدأ العمل الإضافي بعد 8 ساعات يومياً.'
          )}
        </p>
      </div>

      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('From', 'من')}</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">{t('To', 'إلى')}</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
        </div>
        <Button onClick={() => load()}>{t('Refresh', 'تحديث')}</Button>
        <Button
          variant="outline"
          className="border-slate-600 text-slate-200 hover:bg-slate-800"
          onClick={() => saveDraft()}
          disabled={saving || loading || !rows.length}
        >
          {saving ? t('Saving…', 'جارٍ الحفظ…') : t('Save draft', 'حفظ كمسودة')}
        </Button>
        <Button
          variant="outline"
          className="border-emerald-700 text-emerald-200 hover:bg-emerald-900/30"
          onClick={() => runStatusAction('approve_all')}
          disabled={Boolean(updatingStatus) || loading || !rows.length}
        >
          {updatingStatus === 'approve' ? t('Approving…', 'جارٍ الاعتماد…') : t('Approve all', 'اعتماد الكل')}
        </Button>
        <Button
          variant="outline"
          className="border-blue-700 text-blue-200 hover:bg-blue-900/30"
          onClick={() => runStatusAction('paid_all')}
          disabled={Boolean(updatingStatus) || loading || !rows.length}
        >
          {updatingStatus === 'paid' ? t('Marking…', 'جارٍ الوسم…') : t('Mark all paid', 'وسم الكل مدفوع')}
        </Button>
        <Button
          variant="ghost"
          className="text-slate-300 hover:bg-slate-800"
          onClick={() => {
            const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString()
            const toIso = new Date(`${to}T00:00:00.000Z`).toISOString()
            window.open(
              `/api/tenants/${slug}/payroll/export?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
              '_blank'
            )
          }}
          disabled={loading || !rows.length}
        >
          {t('Export CSV', 'تصدير CSV')}
        </Button>
      </div>

      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
        {loading ? (
          <p className="text-slate-400">{t('Loading…', 'جاري التحميل…')}</p>
        ) : !data ? (
          <p className="text-slate-400">{t('No payroll data.', 'لا توجد بيانات رواتب.')}</p>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-slate-300">
              {t('Total gross pay', 'إجمالي الرواتب')}: <span className="font-bold">{data.totals.grossPay.toFixed(2)} ILS</span>
            </div>
            <div className="text-sm text-slate-300">
              {t('Projected net pay', 'صافي الرواتب المتوقع')}: <span className="font-bold">{computedNetTotal} ILS</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-400">
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-2">{t('Staff', 'الموظف')}</th>
                    <th className="text-left py-2">{t('Status', 'الحالة')}</th>
                    <th className="text-left py-2">{t('Regular hours', 'ساعات عادية')}</th>
                    <th className="text-left py-2">{t('Overtime hours', 'ساعات إضافية')}</th>
                    <th className="text-left py-2">{t('Rate', 'الأجر')}</th>
                    <th className="text-left py-2">{t('Gross', 'الإجمالي')}</th>
                    <th className="text-left py-2">{t('Adjustment', 'تعديل')}</th>
                    <th className="text-left py-2">{t('Net', 'الصافي')}</th>
                    <th className="text-left py-2">{t('Notes', 'ملاحظات')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.staffId} className="border-b border-slate-900">
                      <td className="py-2 text-slate-200">{r.displayName || r.email}</td>
                      <td className="py-2 text-slate-300 uppercase text-xs">{r.status}</td>
                      <td className="py-2 text-slate-300">{r.regularHours.toFixed(2)}</td>
                      <td className="py-2 text-slate-300">{r.overtimeHours.toFixed(2)}</td>
                      <td className="py-2 text-slate-300">
                        {r.hourlyRate.toFixed(2)} (x{r.overtimeMultiplier.toFixed(2)})
                      </td>
                      <td className="py-2 text-white font-semibold">{r.grossPay.toFixed(2)} ILS</td>
                      <td className="py-2 min-w-[120px]">
                        <Input
                          type="number"
                          step="0.01"
                          value={edits[r.staffId]?.adjustments ?? String(r.adjustments ?? 0)}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [r.staffId]: {
                                adjustments: e.target.value,
                                notes: prev[r.staffId]?.notes ?? r.notes ?? '',
                              },
                            }))
                          }
                          className="h-9 bg-slate-800 border-slate-600 text-white"
                        />
                      </td>
                      <td className="py-2 text-emerald-300 font-semibold">
                        {(
                          r.grossPay +
                          (Number.isFinite(Number(edits[r.staffId]?.adjustments))
                            ? Number(edits[r.staffId]?.adjustments)
                            : 0)
                        ).toFixed(2)}{' '}
                        ILS
                      </td>
                      <td className="py-2 min-w-[220px]">
                        <Input
                          value={edits[r.staffId]?.notes ?? r.notes ?? ''}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [r.staffId]: {
                                adjustments: prev[r.staffId]?.adjustments ?? String(r.adjustments ?? 0),
                                notes: e.target.value,
                              },
                            }))
                          }
                          placeholder={t('Optional payroll note', 'ملاحظة رواتب اختيارية')}
                          className="h-9 bg-slate-800 border-slate-600 text-white"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

