import { auth } from '@clerk/nextjs/server'
import { getTenantBySlug } from './tenant'
import { isSuperAdminEmail } from './constants'
import { getEmailForUser } from './getClerkEmail'
import { getStaffPermissions, type StaffPermission, STAFF_PERMISSIONS, type StaffRole } from './staff-permissions'

export type TenantAuthResult =
  | {
      ok: true
      tenantId: string
      slug: string
      isSuperAdmin: boolean
      /** True if user is owner or co-owner (not staff). */
      isOwner: boolean
      /** When staff: waiter | cashier | manager | custom. When owner: 'owner'. */
      role: 'owner' | StaffRole
      /** Resolved permissions for this user. Owner has all. */
      permissions: StaffPermission[]
    }
  | { ok: false; status: 403 | 404 }

/** Verify the current user can access the tenant (owner, co-owner, or staff with any permission). Returns role and permissions. */
export async function checkTenantAuth(slug: string): Promise<TenantAuthResult> {
  const tenant = await getTenantBySlug(slug)
  if (!tenant) return { ok: false, status: 404 }

  const { userId, sessionClaims } = await auth()
  if (!userId) return { ok: false, status: 403 }

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  const isSuperAdmin = isSuperAdminEmail(email)
  if (tenant.blockedBySuperAdmin && !isSuperAdmin) {
    return { ok: false, status: 403 }
  }
  const emailLower = (email as string)?.trim().toLowerCase()
  const primaryMatch = emailLower && tenant.clerkUserEmail && emailLower === (tenant.clerkUserEmail as string).trim().toLowerCase()
  const coOwnerMatch = emailLower && Array.isArray(tenant.coOwnerEmails) && tenant.coOwnerEmails.some((e) => (e || '').trim().toLowerCase() === emailLower)
  if (isSuperAdmin || tenant.clerkUserId === userId || primaryMatch || coOwnerMatch) {
    return {
      ok: true,
      tenantId: tenant._id,
      slug: tenant.slug,
      isSuperAdmin,
      isOwner: true,
      role: 'owner',
      permissions: [...STAFF_PERMISSIONS],
    }
  }

  // Staff: resolve by staff document for this tenant and email
  const { client } = await import('@/sanity/lib/client')
  const clientNoCdn = client.withConfig({ useCdn: false })
  const staff = await clientNoCdn.fetch<{
    _id: string
    email: string
    role: string
    permissions?: string[] | null
  } | null>(
    `*[_type == "tenantStaff" && site._ref == $tenantId && lower(email) == $emailLower][0]{ _id, email, role, permissions }`,
    { tenantId: tenant._id, emailLower: emailLower || '' }
  )
  if (staff) {
    const permissions = getStaffPermissions({
      _id: staff._id,
      email: staff.email,
      role: staff.role as StaffRole,
      permissions: staff.permissions ?? undefined,
    })
    return {
      ok: true,
      tenantId: tenant._id,
      slug: tenant.slug,
      isSuperAdmin: false,
      isOwner: false,
      role: staff.role as StaffRole,
      permissions,
    }
  }

  return { ok: false, status: 403 }
}
