/**
 * Staff roles and permissions for tenant (business) dashboard.
 * Owner/coOwner have all permissions. Staff get role-based or custom permissions.
 */

export const STAFF_PERMISSIONS = [
  'orders',
  'history',
  'staff_manage',
  'billing',
  'payroll',
  'settings_business',
  'settings_menu',
  'settings_tables',
  'settings_drivers',
  'analytics',
  'transfer',
] as const

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number]

export const ROLE_DEFAULTS: Record<string, StaffPermission[]> = {
  waiter: ['orders'],
  cashier: ['orders', 'history', 'analytics'],
  kitchen: ['orders'],
  dispatcher: ['orders', 'settings_drivers'],
  accountant: ['history', 'analytics', 'billing', 'payroll'],
  manager: [
    'orders',
    'history',
    'staff_manage',
    'billing',
    'payroll',
    'settings_business',
    'settings_menu',
    'settings_tables',
    'settings_drivers',
    'analytics',
  ],
  custom: [], // must be set explicitly via permissions array
}

export type StaffRole =
  | 'waiter'
  | 'cashier'
  | 'kitchen'
  | 'dispatcher'
  | 'accountant'
  | 'manager'
  | 'custom'

export interface StaffMemberForAuth {
  _id: string
  email: string
  role: StaffRole
  permissions?: string[] | null
}

/** Resolve effective permissions for a staff member (role defaults + overrides). */
export function getStaffPermissions(member: StaffMemberForAuth): StaffPermission[] {
  const rolePerms = ROLE_DEFAULTS[member.role] ?? []
  const override = Array.isArray(member.permissions) ? member.permissions : []
  if (override.length > 0) {
    return sanitizeStaffPermissions(override)
  }
  return sanitizeStaffPermissions(rolePerms)
}

/** Check if permission set includes the given permission. */
export function hasPermission(permissions: StaffPermission[], permission: StaffPermission): boolean {
  return permissions.includes(permission)
}

/** Permission required for each manage section (path segment). */
export const PATH_PERMISSION: Record<string, StaffPermission> = {
  business: 'settings_business',
  menu: 'settings_menu',
  tables: 'settings_tables',
  attendance: 'orders',
  payroll: 'payroll',
  drivers: 'settings_drivers',
  analytics: 'analytics',
  history: 'history',
  billing: 'billing',
  transfer: 'transfer',
  staff: 'staff_manage',
}

/** Orders page requires 'orders'. */
export const ORDERS_PERMISSION: StaffPermission = 'orders'

/** Check if auth result (owner or staff) has the given permission. Use after checkTenantAuth. */
export function requirePermission(
  auth: { ok: true; permissions: StaffPermission[] },
  permission: StaffPermission
): boolean {
  return auth.permissions.includes(permission)
}

const OWNER_ONLY_PERMISSIONS: StaffPermission[] = ['transfer']

export function sanitizeStaffPermissions(perms: string[] | StaffPermission[]): StaffPermission[] {
  const seen = new Set<StaffPermission>()
  const result: StaffPermission[] = []
  for (const p of perms) {
    if (!STAFF_PERMISSIONS.includes(p as StaffPermission)) continue
    const perm = p as StaffPermission
    if (OWNER_ONLY_PERMISSIONS.includes(perm)) continue
    if (seen.has(perm)) continue
    seen.add(perm)
    result.push(perm)
  }
  return result
}
