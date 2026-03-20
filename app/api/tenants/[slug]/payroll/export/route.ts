import { NextRequest, NextResponse } from 'next/server'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { computePayrollData } from '@/lib/payroll-data'

function escapeCsv(value: unknown): string {
  const s = String(value ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
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

  const fromRaw = req.nextUrl.searchParams.get('from') || ''
  const toRaw = req.nextUrl.searchParams.get('to') || ''
  const from = new Date(fromRaw)
  const to = new Date(toRaw)
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from) {
    return NextResponse.json({ error: 'Invalid payroll period' }, { status: 400 })
  }
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  const { rows, totals } = await computePayrollData({
    tenantId: auth.tenantId,
    fromIso,
    toIso,
  })

  const header = [
    'staff_name',
    'email',
    'status',
    'regular_hours',
    'overtime_hours',
    'hourly_rate',
    'overtime_multiplier',
    'gross_pay',
    'adjustments',
    'net_pay',
    'notes',
  ]
  const body = rows.map((r) => [
    r.displayName || r.email,
    r.email,
    r.status,
    r.regularHours.toFixed(2),
    r.overtimeHours.toFixed(2),
    r.hourlyRate.toFixed(2),
    r.overtimeMultiplier.toFixed(2),
    r.grossPay.toFixed(2),
    r.adjustments.toFixed(2),
    r.netPay.toFixed(2),
    r.notes || '',
  ])
  const footer = [
    'TOTAL',
    '',
    '',
    totals.regularHours.toFixed(2),
    totals.overtimeHours.toFixed(2),
    '',
    '',
    totals.grossPay.toFixed(2),
    '',
    totals.netPay.toFixed(2),
    '',
  ]

  const lines = [header, ...body, footer].map((row) => row.map(escapeCsv).join(',')).join('\n')
  const filename = `payroll-${fromIso.slice(0, 10)}-to-${toIso.slice(0, 10)}.csv`

  return new NextResponse(lines, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

