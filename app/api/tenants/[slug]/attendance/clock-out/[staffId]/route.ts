import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission } from '@/lib/staff-permissions'
import { getEmailForUser } from '@/lib/getClerkEmail'

const noCacheClient = client.withConfig({ useCdn: false })
const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; staffId: string }> }
) {
  const { slug, staffId } = await params
  const tenantAuth = await checkTenantAuth(slug)
  if (!tenantAuth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: tenantAuth.status })
  if (!requirePermission(tenantAuth, 'staff_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const managerEmail =
    (await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null) || '').trim().toLowerCase()

  const staff = await noCacheClient.fetch<{ _id: string; site?: { _ref?: string } } | null>(
    `*[_type == "tenantStaff" && _id == $id][0]{ _id, "site": site }`,
    { id: staffId }
  )
  if (!staff?._id || staff.site?._ref !== tenantAuth.tenantId) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
  }

  const openSession = await noCacheClient.fetch<{ _id: string; clockInAt?: string } | null>(
    `*[
      _type == "staffAttendanceSession" &&
      site._ref == $tenantId &&
      status == "open" &&
      staff._ref == $staffId
    ][0]{ _id, clockInAt }`,
    { tenantId: tenantAuth.tenantId, staffId }
  )
  if (!openSession?._id) {
    return NextResponse.json({ error: 'No open attendance session found for this staff member' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  const now = new Date()
  const nowIso = now.toISOString()
  const clockInMs = openSession.clockInAt ? new Date(openSession.clockInAt).getTime() : NaN
  const totalMinutes =
    Number.isFinite(clockInMs) ? Math.max(0, Math.round((now.getTime() - clockInMs) / 60000)) : 0

  await writeClient.patch(openSession._id).set({
    status: 'closed',
    clockOutAt: nowIso,
    clockOutMethod: 'manager_force',
    ...(reason ? { clockOutReason: reason } : {}),
    ...(managerEmail ? { closedByEmail: managerEmail } : {}),
    totalMinutes,
  }).commit()

  return NextResponse.json({
    success: true,
    sessionId: openSession._id,
    clockOutAt: nowIso,
    totalMinutes,
    clockOutMethod: 'manager_force',
  })
}

