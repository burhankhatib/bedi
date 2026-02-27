import { client } from '@/sanity/lib/client'

export type AccountType = 'driver' | 'tenant' | null

export type PlatformUser = {
  _id: string
  clerkUserId: string
  accountType: AccountType
  isTenant: boolean
  isDriver: boolean
}

const PLATFORM_USER_QUERY = `*[_type == "platformUser" && clerkUserId == $clerkUserId][0]{
  _id,
  clerkUserId,
  accountType,
  isTenant,
  isDriver
}`

/**
 * Fetch platform user by Clerk ID. Returns null if not found.
 */
export async function getPlatformUser(clerkUserId: string): Promise<PlatformUser | null> {
  if (!clerkUserId) return null
  try {
    const doc = await client.fetch<{
      _id: string
      clerkUserId: string
      accountType?: string | null
      isTenant?: boolean
      isDriver?: boolean
    } | null>(PLATFORM_USER_QUERY, { clerkUserId })
    if (!doc) return null
    const accountType: AccountType =
      doc.accountType === 'driver' ? 'driver' : doc.accountType === 'tenant' ? 'tenant' : null
    return {
      _id: doc._id,
      clerkUserId: doc.clerkUserId,
      accountType,
      isTenant: doc.isTenant === true,
      isDriver: doc.isDriver === true,
    }
  } catch {
    return null
  }
}

/**
 * Resolve account type from live data (tenants + driver). Mutually exclusive:
 * - Has tenants → tenant only (business dashboard).
 * - Has driver and no tenants → driver only (driver dashboard).
 * - Neither → null (onboarding).
 */
export function resolveAccountType(hasTenants: boolean, hasDriver: boolean): AccountType {
  if (hasTenants) return 'tenant'
  if (hasDriver) return 'driver'
  return null
}
