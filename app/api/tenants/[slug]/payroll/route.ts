import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { computePayrollData, type PayrollStatus } from '@/lib/payroll-data'

const noCacheClient = client.withConfig({ useCdn: false })
const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

function monthRangeUtc(now = new Date()): { fromIso: string; toIso: string } {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0))
  return { fromIso: start.toISOString(), toIso: end.toISOString() }
}

function normalizeRange(searchParams: URLSearchParams): { fromIso: string; toIso: string } {
  const def = monthRangeUtc()
  const fromRaw = searchParams.get('from') || def.fromIso
  const toRaw = searchParams.get('to') || def.toIso
  const from = new Date(fromRaw)
  const to = new Date(toRaw)
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from) return def
  return { fromIso: from.toISOString(), toIso: to.toISOString() }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
  if (!requirePermission(auth, 'payroll')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { fromIso, toIso } = normalizeRange(req.nextUrl.searchParams)

  const { rows, totals } = await computePayrollData({
    tenantId: auth.tenantId,
    fromIso,
    toIso,
  })

  return NextResponse.json({
    success: true,
    period: { from: fromIso, to: toIso },
    rows,
    totals: {
      regularMinutes: totals.regularMinutes,
      overtimeMinutes: totals.overtimeMinutes,
      regularHours: totals.regularHours,
      overtimeHours: totals.overtimeHours,
      grossPay: totals.grossPay,
      netPay: totals.netPay,
    },
  })
}

type PayrollEdit = { staffId: string; adjustments?: number; notes?: string }

function periodDocId(tenantId: string, staffId: string, fromIso: string, toIso: string): string {
  const clean = (v: string) => v.replace(/[^a-zA-Z0-9_-]/g, '_')
  return `staffPayrollPeriod.${clean(tenantId)}.${clean(staffId)}.${clean(fromIso)}.${clean(toIso)}`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
  if (!requirePermission(auth, 'payroll')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  const fromRaw = typeof body?.from === 'string' ? body.from : ''
  const toRaw = typeof body?.to === 'string' ? body.to : ''
  const from = new Date(fromRaw)
  const to = new Date(toRaw)
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from) {
    return NextResponse.json({ error: 'Invalid payroll period' }, { status: 400 })
  }
  const fromIso = from.toISOString()
  const toIso = to.toISOString()
  const edits = Array.isArray(body?.edits) ? (body.edits as PayrollEdit[]) : []
  const editByStaff = new Map<string, PayrollEdit>()
  for (const e of edits) {
    if (!e?.staffId) continue
    editByStaff.set(e.staffId, e)
  }

  const { rows } = await computePayrollData({
    tenantId: auth.tenantId,
    fromIso,
    toIso,
  })

  await Promise.all(
    rows.map(async (row) => {
      const edit = editByStaff.get(row.staffId)
      const adjustments =
        typeof edit?.adjustments === 'number' && Number.isFinite(edit.adjustments)
          ? edit.adjustments
          : row.adjustments || 0
      const notes = typeof edit?.notes === 'string' ? edit.notes.trim() : row.notes || ''
      const netPay = Number((row.grossPay + adjustments).toFixed(2))
      const docId = row.payrollDocId || periodDocId(auth.tenantId, row.staffId, fromIso, toIso)
      await writeClient
        .createIfNotExists({
          _id: docId,
          _type: 'staffPayrollPeriod',
          site: { _type: 'reference', _ref: auth.tenantId },
          staff: { _type: 'reference', _ref: row.staffId },
          periodStart: fromIso,
          periodEnd: toIso,
          status: 'draft',
        })
      await writeClient
        .patch(docId)
        .set({
          regularMinutes: row.regularMinutes,
          overtimeMinutes: row.overtimeMinutes,
          hourlyRateSnapshot: row.hourlyRate,
          overtimeMultiplierSnapshot: row.overtimeMultiplier,
          grossPay: row.grossPay,
          adjustments,
          netPay,
          notes,
          status: 'draft',
        })
        .commit()
    })
  )

  return NextResponse.json({ success: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
  if (!requirePermission(auth, 'payroll')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  const action = typeof body?.action === 'string' ? body.action : ''
  const fromRaw = typeof body?.from === 'string' ? body.from : ''
  const toRaw = typeof body?.to === 'string' ? body.to : ''
  const from = new Date(fromRaw)
  const to = new Date(toRaw)
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from) {
    return NextResponse.json({ error: 'Invalid payroll period' }, { status: 400 })
  }
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  let targetStatus: PayrollStatus
  if (action === 'approve_all') targetStatus = 'approved'
  else if (action === 'paid_all') targetStatus = 'paid'
  else return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })

  const docs = await noCacheClient.fetch<Array<{ _id: string }>>(
    `*[
      _type == "staffPayrollPeriod" &&
      site._ref == $tenantId &&
      periodStart == $fromIso &&
      periodEnd == $toIso
    ]{ _id }`,
    { tenantId: auth.tenantId, fromIso, toIso }
  )
  if (!docs.length) {
    return NextResponse.json({ error: 'No payroll drafts found for this period. Save draft first.' }, { status: 400 })
  }

  await Promise.all(docs.map((d) => writeClient.patch(d._id).set({ status: targetStatus }).commit()))
  return NextResponse.json({ success: true, updated: docs.length, status: targetStatus })
}

