import { client } from '@/sanity/lib/client'
import { calculatePayrollSummary } from '@/lib/payroll-calculator'

const noCacheClient = client.withConfig({ useCdn: false })

export type PayrollStatus = 'draft' | 'approved' | 'paid'

export type PayrollDataRow = {
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
  status: PayrollStatus
  notes?: string
}

export async function computePayrollData(params: {
  tenantId: string
  fromIso: string
  toIso: string
}): Promise<{
  rows: PayrollDataRow[]
  totals: {
    regularMinutes: number
    overtimeMinutes: number
    regularHours: number
    overtimeHours: number
    grossPay: number
    netPay: number
  }
}> {
  const { tenantId, fromIso, toIso } = params

  const [staff, sessions, persisted] = await Promise.all([
    noCacheClient.fetch<
      Array<{
        _id: string
        email: string
        displayName?: string
        status?: string
        workSchedule?: { timezone?: string }
        payrollProfile?: { hourlyRate?: number; overtimeMultiplier?: number }
      }>
    >(
      `*[
        _type == "tenantStaff" &&
        site._ref == $tenantId &&
        (!defined(status) || status != "archived")
      ]{
        _id,
        email,
        displayName,
        status,
        workSchedule,
        payrollProfile
      }`,
      { tenantId }
    ),
    noCacheClient.fetch<
      Array<{
        _id: string
        actorEmail?: string
        clockInAt?: string
        clockOutAt?: string
        totalMinutes?: number
      }>
    >(
      `*[
        _type == "staffAttendanceSession" &&
        site._ref == $tenantId &&
        status == "closed" &&
        defined(clockInAt) &&
        defined(clockOutAt) &&
        clockInAt < $toIso &&
        clockOutAt > $fromIso
      ]{
        _id,
        actorEmail,
        clockInAt,
        clockOutAt,
        totalMinutes
      }`,
      { tenantId, fromIso, toIso }
    ),
    noCacheClient.fetch<
      Array<{
        _id: string
        staffId?: string
        adjustments?: number
        netPay?: number
        status?: PayrollStatus
        notes?: string
      }>
    >(
      `*[
        _type == "staffPayrollPeriod" &&
        site._ref == $tenantId &&
        periodStart == $fromIso &&
        periodEnd == $toIso
      ]{
        _id,
        "staffId": staff._ref,
        adjustments,
        netPay,
        status,
        notes
      }`,
      { tenantId, fromIso, toIso }
    ),
  ])

  const byEmail = new Map<string, typeof sessions>()
  for (const s of sessions ?? []) {
    const key = (s.actorEmail || '').trim().toLowerCase()
    if (!key) continue
    if (!byEmail.has(key)) byEmail.set(key, [])
    byEmail.get(key)!.push(s)
  }

  const persistedByStaffId = new Map<string, (typeof persisted)[number]>()
  for (const p of persisted ?? []) {
    if (!p.staffId) continue
    persistedByStaffId.set(p.staffId, p)
  }

  const rows: PayrollDataRow[] = (staff ?? []).map((st) => {
    const email = (st.email || '').trim().toLowerCase()
    const staffSessions = byEmail.get(email) ?? []
    const base = calculatePayrollSummary({
      staff: {
        staffId: st._id,
        email: st.email,
        displayName: st.displayName,
        timezone: st.workSchedule?.timezone,
        hourlyRate: st.payrollProfile?.hourlyRate,
        overtimeMultiplier: st.payrollProfile?.overtimeMultiplier,
      },
      sessions: staffSessions,
      periodStartIso: fromIso,
      periodEndIso: toIso,
    })
    const persistedRow = persistedByStaffId.get(st._id)
    const adjustments =
      typeof persistedRow?.adjustments === 'number' && Number.isFinite(persistedRow.adjustments)
        ? persistedRow.adjustments
        : 0
    const netPay =
      typeof persistedRow?.netPay === 'number' && Number.isFinite(persistedRow.netPay)
        ? persistedRow.netPay
        : Number((base.grossPay + adjustments).toFixed(2))
    const status: PayrollStatus = persistedRow?.status || 'draft'
    return {
      payrollDocId: persistedRow?._id,
      ...base,
      adjustments,
      netPay,
      status,
      notes: persistedRow?.notes || '',
    }
  })

  const totals = rows.reduce(
    (acc, r) => {
      acc.regularMinutes += r.regularMinutes
      acc.overtimeMinutes += r.overtimeMinutes
      acc.grossPay = Number((acc.grossPay + r.grossPay).toFixed(2))
      acc.netPay = Number((acc.netPay + r.netPay).toFixed(2))
      return acc
    },
    { regularMinutes: 0, overtimeMinutes: 0, grossPay: 0, netPay: 0 }
  )

  return {
    rows,
    totals: {
      regularMinutes: totals.regularMinutes,
      overtimeMinutes: totals.overtimeMinutes,
      regularHours: totals.regularMinutes / 60,
      overtimeHours: totals.overtimeMinutes / 60,
      grossPay: totals.grossPay,
      netPay: totals.netPay,
    },
  }
}

