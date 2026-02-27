import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission, type StaffPermission } from '@/lib/staff-permissions'
import { STAFF_PERMISSIONS, ROLE_DEFAULTS, type StaffRole } from '@/lib/staff-permissions'

const noCacheClient = client.withConfig({ useCdn: false })
const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

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
  if (typeof body.displayName === 'string') patch.set({ displayName: body.displayName.trim() || undefined })
  if (['waiter', 'cashier', 'manager', 'custom'].includes(body.role)) {
    patch.set({ role: body.role as StaffRole })
    if (body.role === 'custom' && Array.isArray(body.permissions)) {
      const perms = body.permissions.filter((p: unknown) => STAFF_PERMISSIONS.includes(p as StaffPermission))
      patch.set({ permissions: perms })
    } else if (body.role !== 'custom') {
      patch.unset(['permissions'])
    }
  }

  await patch.commit()
  const updated = await noCacheClient.fetch<{ _id: string; email: string; displayName?: string | null; role: string; permissions?: string[] | null } | null>(
    `*[_type == "tenantStaff" && _id == $id][0]{ _id, email, displayName, role, permissions }`,
    { id }
  )
  const perms = updated?.role === 'custom' && Array.isArray(updated?.permissions) ? updated.permissions : (ROLE_DEFAULTS[updated?.role ?? ''] ?? [])
  return NextResponse.json({
    staff: {
      _id: updated?._id,
      email: updated?.email,
      displayName: updated?.displayName ?? null,
      role: updated?.role,
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
