import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission, sanitizeStaffPermissions, type StaffPermission } from '@/lib/staff-permissions'
import { ROLE_DEFAULTS, type StaffRole } from '@/lib/staff-permissions'

const noCacheClient = client.withConfig({ useCdn: false })
const writeClient = client.withConfig({ token: token || undefined, useCdn: false })
const STAFF_ROLES: StaffRole[] = [
  'waiter',
  'cashier',
  'kitchen',
  'dispatcher',
  'accountant',
  'manager',
  'custom',
]

type StaffScheduleDay = {
  dayOfWeek: number
  enabled?: boolean
  start?: string
  end?: string
}

function normalizeScheduleDays(input: unknown): StaffScheduleDay[] | undefined {
  if (!Array.isArray(input)) return undefined
  const out: StaffScheduleDay[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const dayNum = Number(row.dayOfWeek)
    if (!Number.isInteger(dayNum) || dayNum < 0 || dayNum > 6) continue
    const start = typeof row.start === 'string' ? row.start.trim() : ''
    const end = typeof row.end === 'string' ? row.end.trim() : ''
    out.push({
      dayOfWeek: dayNum,
      enabled: row.enabled !== false,
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
    })
  }
  return out
}

/** GET - List staff members for this tenant. Requires staff_manage (or owner). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const authResult = await checkTenantAuth(slug)
  if (!authResult.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: authResult.status })
  if (!requirePermission(authResult, 'staff_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const staffList = await noCacheClient.fetch<
    {
      _id: string
      email: string
      displayName?: string | null
      role: string
      status?: string | null
      phone?: string | null
      whatsappPhone?: string | null
      permissions?: string[] | null
      notificationRules?: Record<string, unknown> | null
      workSchedule?: Record<string, unknown> | null
      payrollProfile?: Record<string, unknown> | null
      createdAt?: string | null
    }[]
  >(
    `*[_type == "tenantStaff" && site._ref == $tenantId] | order(createdAt asc){
      _id, email, displayName, role, status, phone, whatsappPhone, permissions, notificationRules, workSchedule, payrollProfile, createdAt
    }`,
    { tenantId: authResult.tenantId }
  )

  const tenant = await noCacheClient.fetch<{ clerkUserEmail?: string | null; coOwnerEmails?: string[] | null } | null>(
    `*[_type == "tenant" && _id == $tenantId][0]{ clerkUserEmail, coOwnerEmails }`,
    { tenantId: authResult.tenantId }
  )
  const ownerEmail = (tenant?.clerkUserEmail as string)?.trim().toLowerCase()
  const coOwnerSet = new Set((tenant?.coOwnerEmails ?? []).map((e) => String(e).trim().toLowerCase()))

  const list = (staffList ?? []).map((s) => {
    const perms = Array.isArray(s.permissions) ? s.permissions : []
    const effective = s.role === 'custom' && perms.length > 0 ? sanitizeStaffPermissions(perms) : (ROLE_DEFAULTS[s.role] ?? [])
    const isOwner = ownerEmail && s.email?.toLowerCase() === ownerEmail
    const isCoOwner = coOwnerSet.has((s.email ?? '').toLowerCase())
    return {
      _id: s._id,
      email: s.email,
      displayName: s.displayName ?? null,
      role: s.role,
      status: (s.status as string) || 'active',
      phone: s.phone ?? null,
      whatsappPhone: s.whatsappPhone ?? null,
      permissions: effective as StaffPermission[],
      notificationRules: s.notificationRules ?? null,
      workSchedule: s.workSchedule ?? null,
      payrollProfile: s.payrollProfile ?? null,
      createdAt: s.createdAt ?? null,
      isOwnerOrCoOwner: isOwner || isCoOwner,
    }
  })

  return NextResponse.json({ staff: list })
}

/** POST - Add a staff member. Requires staff_manage. Body: { email, displayName?, role?, permissions? } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const authResult = await checkTenantAuth(slug)
  if (!authResult.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: authResult.status })
  if (!requirePermission(authResult, 'staff_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
  const emailLower = email.toLowerCase()
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : undefined
  const role = (STAFF_ROLES.includes(body.role) ? body.role : 'waiter') as StaffRole
  const status = body.status === 'suspended' || body.status === 'archived' ? body.status : 'active'
  const permissions = Array.isArray(body.permissions) ? sanitizeStaffPermissions(body.permissions) : undefined
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const whatsappPhone = typeof body.whatsappPhone === 'string' ? body.whatsappPhone.trim() : ''
  const workScheduleDays = normalizeScheduleDays(body?.workSchedule?.days)
  const workScheduleTz =
    typeof body?.workSchedule?.timezone === 'string' && body.workSchedule.timezone.trim()
      ? body.workSchedule.timezone.trim()
      : 'Asia/Jerusalem'
  const hourlyRate =
    typeof body?.payrollProfile?.hourlyRate === 'number' && Number.isFinite(body.payrollProfile.hourlyRate)
      ? Math.max(0, body.payrollProfile.hourlyRate)
      : undefined
  const overtimeMultiplier =
    typeof body?.payrollProfile?.overtimeMultiplier === 'number' &&
    Number.isFinite(body.payrollProfile.overtimeMultiplier)
      ? Math.max(1, body.payrollProfile.overtimeMultiplier)
      : 1.5

  const tenant = await noCacheClient.fetch<{ _id: string; clerkUserEmail?: string | null } | null>(
    `*[_type == "tenant" && _id == $tenantId][0]{ _id, clerkUserEmail }`,
    { tenantId: authResult.tenantId }
  )
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const existing = await noCacheClient.fetch<{ _id: string } | null>(
    `*[_type == "tenantStaff" && site._ref == $tenantId && lower(email) == $emailLower][0]{ _id }`,
    { tenantId: authResult.tenantId, emailLower }
  )
  if (existing) return NextResponse.json({ error: 'This email is already added as staff' }, { status: 409 })

  const doc = {
    _type: 'tenantStaff' as const,
    site: { _type: 'reference' as const, _ref: tenant._id },
    email: emailLower,
    role,
    status,
    createdAt: new Date().toISOString(),
    ...(displayName ? { displayName } : {}),
    ...(phone ? { phone } : {}),
    ...(whatsappPhone ? { whatsappPhone } : {}),
    ...(role === 'custom' && permissions?.length ? { permissions } : {}),
    notificationRules: {
      receiveFcm: body?.notificationRules?.receiveFcm !== false,
      receiveWhatsapp: body?.notificationRules?.receiveWhatsapp === true,
      newOrder: body?.notificationRules?.newOrder !== false,
      unacceptedOrderReminder: body?.notificationRules?.unacceptedOrderReminder !== false,
    },
    workSchedule: {
      timezone: workScheduleTz,
      days: workScheduleDays ?? [],
    },
    payrollProfile: {
      ...(hourlyRate != null ? { hourlyRate } : {}),
      overtimeMultiplier,
    },
  }
  const created = await writeClient.create(doc)
  return NextResponse.json({
    staff: {
      _id: created._id,
      email: emailLower,
      displayName: displayName ?? null,
      role,
      status,
      phone: phone || null,
      whatsappPhone: whatsappPhone || null,
      permissions: role === 'custom' ? permissions ?? [] : ROLE_DEFAULTS[role] ?? [],
    },
  })
}
