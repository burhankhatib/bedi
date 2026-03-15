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
  /** Plan tier: basic | pro | ultra. Trial uses ultra; set when paid via BOP. */
  subscriptionPlan?: 'basic' | 'pro' | 'ultra' | null
  createdAt?: string
  businessCreatedAt?: string | null
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
  deliveryPricingMode?: 'areas' | 'distance'
  deliveryFeeMin?: number
  deliveryFeeMax?: number
  deliveryMaxDistanceKm?: number
  country?: string | null
  city?: string | null
  blockedBySuperAdmin?: boolean
  ownerPhone?: string
  catalogHidePrices?: boolean
  locationLat?: number | null
  locationLng?: number | null
  requiresPersonalShopper?: boolean
  shopperFee?: number
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
  subscriptionPlan,
  createdAt,
  businessCreatedAt,
  subscriptionExpiresAt,
  subscriptionLastPaymentAt,
  paypalSubscriptionId,
  deactivated,
  deactivateUntil,
  defaultLanguage,
  supportsDineIn,
  supportsReceiveInPerson,
  supportsDelivery,
  deliveryPricingMode,
  deliveryFeeMin,
  deliveryFeeMax,
  deliveryMaxDistanceKm,
  country,
  city,
  blockedBySuperAdmin,
  catalogHidePrices,
  locationLat,
  locationLng,
  requiresPersonalShopper,
  shopperFee
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
  businessCreatedAt,
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
  businessCreatedAt,
  subscriptionExpiresAt,
  country,
  city,
  blockedBySuperAdmin,
  ownerPhone
}`

const TRIAL_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/** True if the tenant's subscription/trial has ended (business should be hidden and status past_due). */
export function isTenantSubscriptionExpired(tenant: {
  subscriptionExpiresAt?: string | null
  createdAt?: string | null
  businessCreatedAt?: string | null
  subscriptionStatus?: string
}): boolean {
  const now = Date.now()
  if (tenant.subscriptionExpiresAt) {
    return new Date(tenant.subscriptionExpiresAt).getTime() <= now
  }
  if ((tenant.subscriptionStatus === 'trial' || !tenant.subscriptionStatus)) {
    const createdDate = tenant.businessCreatedAt || tenant.createdAt
    if (createdDate) {
      const end = new Date(createdDate).getTime() + TRIAL_DAYS_MS
      return end <= now
    }
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

/** @deprecated Tenant delivery areas removed; delivery uses distance-based pricing. Always returns 0. */
export async function getDeliveryAreasCount(_siteId: string): Promise<number> {
  return 0
}
