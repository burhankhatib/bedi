import { cache } from 'react'
import { client, clientNoCdn } from '@/sanity/lib/client'

export type Tenant = {
  _id: string
  slug: string
  name: string
  /** Display name (English) from business profile when set */
  name_en?: string | null
  /** Display name (Arabic) from business profile when set */
  name_ar?: string | null
  businessType: string
  /** Owner's Clerk user ID. Omitted for staff-only tenant list. */
  clerkUserId?: string
  clerkUserEmail?: string
  /** Additional owner emails (lowercase); any of these can manage the business. */
  coOwnerEmails?: string[]
  subscriptionStatus: string
  createdAt?: string
  /** End of free trial or paid period; business hidden when past this date. */
  subscriptionExpiresAt?: string | null
  /** When the last subscription payment was recorded (for display). */
  subscriptionLastPaymentAt?: string | null
  paypalSubscriptionId?: string | null
  deactivated?: boolean
  deactivateUntil?: string | null
  defaultLanguage?: string | null
  supportsDineIn?: boolean
  supportsReceiveInPerson?: boolean
  supportsDelivery?: boolean
  country?: string | null
  blockedBySuperAdmin?: boolean
}

const TENANT_QUERY = `*[_type == "tenant" && slug.current == $slug][0] {
  _id,
  "slug": slug.current,
  name,
  businessType,
  clerkUserId,
  clerkUserEmail,
  coOwnerEmails,
  subscriptionStatus,
  createdAt,
  subscriptionExpiresAt,
  subscriptionLastPaymentAt,
  paypalSubscriptionId,
  deactivated,
  deactivateUntil,
  defaultLanguage,
  supportsDineIn,
  supportsReceiveInPerson,
  supportsDelivery,
  country,
  blockedBySuperAdmin
}`

/** By clerkUserId or by clerkUserEmail / coOwnerEmails (lowercase) so same email = same dashboard. */
const TENANTS_FOR_USER_QUERY = `*[_type == "tenant" && (
  clerkUserId == $clerkUserId ||
  (defined($clerkUserEmailLower) && $clerkUserEmailLower != "" && (
    (defined(clerkUserEmail) && lower(clerkUserEmail) == $clerkUserEmailLower) ||
    (defined(coOwnerEmails) && $clerkUserEmailLower in coOwnerEmails)
  ))
)] | order(createdAt desc) {
  _id,
  "slug": slug.current,
  name,
  businessType,
  clerkUserId,
  clerkUserEmail,
  coOwnerEmails,
  subscriptionStatus,
  createdAt,
  subscriptionExpiresAt
}`

const ALL_TENANTS_QUERY = `*[_type == "tenant"] | order(createdAt desc) {
  _id,
  "slug": slug.current,
  name,
  businessType,
  clerkUserId,
  clerkUserEmail,
  coOwnerEmails,
  subscriptionStatus,
  createdAt,
  subscriptionExpiresAt,
  blockedBySuperAdmin
}`

const TRIAL_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/** True if the tenant's subscription/trial has ended (business should be hidden and status past_due). */
export function isTenantSubscriptionExpired(tenant: {
  subscriptionExpiresAt?: string | null
  createdAt?: string | null
  subscriptionStatus?: string
}): boolean {
  const now = Date.now()
  if (tenant.subscriptionExpiresAt) {
    return new Date(tenant.subscriptionExpiresAt).getTime() <= now
  }
  if ((tenant.subscriptionStatus === 'trial' || !tenant.subscriptionStatus) && tenant.createdAt) {
    const end = new Date(tenant.createdAt).getTime() + TRIAL_DAYS_MS
    return end <= now
  }
  return false
}

/** Get tenant by URL slug (e.g. from /t/[slug]). Uses no-CDN for fresh data on menu pages. Cached per request so metadata + page share one fetch. */
export const getTenantBySlug = cache(async function getTenantBySlug(
  slug: string,
  options?: { useCdn?: boolean }
): Promise<Tenant | null> {
  if (!slug) return null
  const c = options?.useCdn === false ? clientNoCdn : client
  const t = await c.fetch<Tenant | null>(TENANT_QUERY, { slug })
  return t ?? null
})

/** Get all tenants for this user (by Clerk user ID and optionally by owner email so same email = same list). */
export async function getTenantsForUser(
  clerkUserId: string,
  clerkUserEmail?: string
): Promise<Tenant[]> {
  if (!clerkUserId) return []
  const clerkUserEmailLower = (clerkUserEmail || '').trim().toLowerCase()
  const list = await client.fetch<Tenant[]>(TENANTS_FOR_USER_QUERY, {
    clerkUserId,
    clerkUserEmailLower: clerkUserEmailLower || undefined,
  })
  return list ?? []
}

/** Get all tenants (super admin only) */
export async function getAllTenants(): Promise<Tenant[]> {
  const list = await client.fetch<Tenant[]>(ALL_TENANTS_QUERY)
  return list ?? []
}

/** Resolve tenant _id from slug for use in GROQ filters */
export async function getTenantIdBySlug(slug: string): Promise<string | null> {
  const t = await getTenantBySlug(slug)
  return t?._id ?? null
}

const TENANT_BY_PAYPAL_SUBSCRIPTION_QUERY = `*[_type == "tenant" && paypalSubscriptionId == $id][0] {
  _id,
  subscriptionExpiresAt
}`

/** Get tenant by PayPal subscription ID (for webhook: extend on PAYMENT.SALE.COMPLETED). */
export async function getTenantByPayPalSubscriptionId(
  paypalSubscriptionId: string
): Promise<{ _id: string; subscriptionExpiresAt?: string | null } | null> {
  if (!paypalSubscriptionId.trim()) return null
  const t = await clientNoCdn.fetch<{ _id: string; subscriptionExpiresAt?: string | null } | null>(
    TENANT_BY_PAYPAL_SUBSCRIPTION_QUERY,
    { id: paypalSubscriptionId.trim() }
  )
  return t ?? null
}

/** Number of active delivery areas for this tenant (for catalog vs order mode). Uses no-CDN when fresh data needed. */
export async function getDeliveryAreasCount(
  siteId: string,
  options?: { useCdn?: boolean }
): Promise<number> {
  if (!siteId) return 0
  const c = options?.useCdn === false ? clientNoCdn : client
  const list = await c.fetch<{ _id: string }[]>(
    `*[_type == "area" && site._ref == $siteId && isActive == true]{ _id }`,
    { siteId }
  )
  return Array.isArray(list) ? list.length : 0
}
