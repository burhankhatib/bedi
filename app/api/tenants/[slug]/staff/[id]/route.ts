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

/** PATCH - Update staff member (role, displayName, permissions). Requires staff_manage. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const authResult = await checkTenantAuth(slug)
  if (!authResult.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: authResult.status })
  if (!requirePermission(authResult, 'staff_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const staff = await noCacheClient.fetch<{ _id: string; site?: { _ref?: string }; email?: string } | null>(
    `*[_type == "tenantStaff" && _id == $id][0]{ _id, "site": site, email }`,
    { id }
  )
  if (!staff || staff.site?._ref !== authResult.tenantId) {
    return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const patch = writeClient.patch(id)
  if (typeof body.displayName === 'string') patch.set({ displayName: body.displayName.trim() || '' })
  if (typeof body.phone === 'string') patch.set({ phone: body.phone.trim() || '' })
  if (typeof body.whatsappPhone === 'string') patch.set({ whatsappPhone: body.whatsappPhone.trim() || '' })
  if (typeof body.status === 'string' && ['active', 'suspended', 'archived'].includes(body.status)) {
    patch.set({ status: body.status })
  }
  if (STAFF_ROLES.includes(body.role)) {
    patch.set({ role: body.role as StaffRole })
    if (body.role === 'custom' && Array.isArray(body.permissions)) {
      const perms = sanitizeStaffPermissions(body.permissions)
      patch.set({ permissions: perms })
    } else if (body.role !== 'custom') {
      patch.unset(['permissions'])
    }
  }
  if (body?.notificationRules && typeof body.notificationRules === 'object') {
    patch.set({
      notificationRules: {
        receiveFcm: body.notificationRules.receiveFcm !== false,
        receiveWhatsapp: body.notificationRules.receiveWhatsapp === true,
        newOrder: body.notificationRules.newOrder !== false,
        unacceptedOrderReminder: body.notificationRules.unacceptedOrderReminder !== false,
      },
    })
  }
  const days = normalizeScheduleDays(body?.workSchedule?.days)
  if (days || typeof body?.workSchedule?.timezone === 'string') {
    patch.set({
      workSchedule: {
        timezone:
          typeof body?.workSchedule?.timezone === 'string' && body.workSchedule.timezone.trim()
            ? body.workSchedule.timezone.trim()
            : 'Asia/Jerusalem',
        days: days ?? [],
      },
    })
  }
  if (body?.payrollProfile && typeof body.payrollProfile === 'object') {
    const nextPayrollProfile: Record<string, unknown> = {}
    if (typeof body.payrollProfile.hourlyRate === 'number' && Number.isFinite(body.payrollProfile.hourlyRate)) {
      nextPayrollProfile.hourlyRate = Math.max(0, body.payrollProfile.hourlyRate)
    }
    if (
      typeof body.payrollProfile.overtimeMultiplier === 'number' &&
      Number.isFinite(body.payrollProfile.overtimeMultiplier)
    ) {
      nextPayrollProfile.overtimeMultiplier = Math.max(1, body.payrollProfile.overtimeMultiplier)
    }
    if (Object.keys(nextPayrollProfile).length > 0) {
      patch.set({ payrollProfile: nextPayrollProfile })
    }
  }

  await patch.commit()
  const updated = await noCacheClient.fetch<{
    _id: string
    email: string
    displayName?: string | null
    role: string
    status?: string | null
    phone?: string | null
    whatsappPhone?: string | null
    permissions?: string[] | null
  } | null>(
    `*[_type == "tenantStaff" && _id == $id][0]{ _id, email, displayName, role, status, phone, whatsappPhone, permissions }`,
    { id }
  )
  const perms =
    updated?.role === 'custom' && Array.isArray(updated?.permissions)
      ? sanitizeStaffPermissions(updated.permissions)
      : (ROLE_DEFAULTS[updated?.role ?? ''] ?? [])
  return NextResponse.json({
    staff: {
      _id: updated?._id,
      email: updated?.email,
      displayName: updated?.displayName ?? null,
      role: updated?.role,
      status: updated?.status ?? 'active',
      phone: updated?.phone ?? null,
      whatsappPhone: updated?.whatsappPhone ?? null,
      permissions: perms as StaffPermission[],
    },
  })
}

/** DELETE - Remove staff member. Requires staff_manage. Cannot remove owner/co-owner. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const authResult = await checkTenantAuth(slug)
  if (!authResult.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: authResult.status })
  if (!requirePermission(authResult, 'staff_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const staff = await noCacheClient.fetch<{ _id: string; site?: { _ref?: string }; email?: string } | null>(
    `*[_type == "tenantStaff" && _id == $id][0]{ _id, "site": site, email }`,
    { id }
  )
  if (!staff || staff.site?._ref !== authResult.tenantId) {
    return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
  }

  const tenant = await noCacheClient.fetch<{ clerkUserEmail?: string | null; coOwnerEmails?: string[] | null } | null>(
    `*[_type == "tenant" && _id == $tenantId][0]{ clerkUserEmail, coOwnerEmails }`,
    { tenantId: authResult.tenantId }
  )
  const ownerEmail = (tenant?.clerkUserEmail as string)?.trim().toLowerCase()
  const coOwnerSet = new Set((tenant?.coOwnerEmails ?? []).map((e) => String(e).trim().toLowerCase()))
  const staffEmailLower = (staff.email ?? '').toLowerCase()
  if (ownerEmail && staffEmailLower === ownerEmail) {
    return NextResponse.json({ error: 'Cannot remove the business owner' }, { status: 403 })
  }
  if (coOwnerSet.has(staffEmailLower)) {
    return NextResponse.json({ error: 'Cannot remove a co-owner from staff' }, { status: 403 })
  }

  await writeClient.delete(id)
  return NextResponse.json({ success: true })
}
