import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { requirePermission, type StaffPermission } from '@/lib/staff-permissions'
import { STAFF_PERMISSIONS, ROLE_DEFAULTS, type StaffRole } from '@/lib/staff-permissions'

const noCacheClient = client.withConfig({ useCdn: false })
const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

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
    { _id: string; email: string; displayName?: string | null; role: string; permissions?: string[] | null; createdAt?: string | null }[]
  >(
    `*[_type == "tenantStaff" && site._ref == $tenantId] | order(createdAt asc){ _id, email, displayName, role, permissions, createdAt }`,
    { tenantId: authResult.tenantId }
  )

  const tenant = await noCacheClient.fetch<{ clerkUserEmail?: string | null; coOwnerEmails?: string[] | null } | null>(
    `*[_type == "tenant" && _id == $tenantId][0]{ clerkUserEmail, coOwnerEmails }`,
    { tenantId: authResult.tenantId }
  )
  const ownerEmail = (tenant?.clerkUserEmail as string)?.trim().toLowerCase()
  const coOwnerSet = new Set((tenant?.coOwnerEmails ?? []).map((e) => String(e).trim().toLowerCase()))

  const list = (staffList ?? []).map((s) => {
    const perms = s.permissions ?? []
    const effective = s.role === 'custom' && perms.length > 0 ? perms : (ROLE_DEFAULTS[s.role] ?? [])
    const isOwner = ownerEmail && s.email?.toLowerCase() === ownerEmail
    const isCoOwner = coOwnerSet.has((s.email ?? '').toLowerCase())
    return {
      _id: s._id,
      email: s.email,
      displayName: s.displayName ?? null,
      role: s.role,
      permissions: effective as StaffPermission[],
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
  const role = (['waiter', 'cashier', 'manager', 'custom'].includes(body.role) ? body.role : 'waiter') as StaffRole
  const permissions = Array.isArray(body.permissions) ? body.permissions.filter((p: unknown) => STAFF_PERMISSIONS.includes(p as StaffPermission)) : undefined

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
    createdAt: new Date().toISOString(),
    ...(displayName ? { displayName } : {}),
    ...(role === 'custom' && permissions?.length ? { permissions } : {}),
  }
  const created = await writeClient.create(doc)
  return NextResponse.json({ staff: { _id: created._id, email: emailLower, displayName: displayName ?? null, role, permissions: permissions ?? [] } })
}
