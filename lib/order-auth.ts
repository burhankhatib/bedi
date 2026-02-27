/**
 * Server-only: get verified phone numbers for a Clerk user.
 * Drivers and tenants with a phone in the system are treated as having that number
 * automatically verified for ordering (no Clerk SMS required).
 */
import { clerkClient } from '@clerk/nextjs/server'
import { clientNoCdn } from '@/sanity/lib/client'
import { toEnglishDigits } from '@/lib/phone'

/** Normalize phone to digits only (no +, spaces, dashes) for comparison. */
export function normalizePhoneDigits(phone: string): string {
  const digits = toEnglishDigits(phone || '').replace(/\D/g, '')
  return digits
}

/** Normalize customer input (e.g. 0501234567) to same form as Clerk E.164 digits (972501234567). */
function normalizeForComparison(phone: string): string {
  let digits = normalizePhoneDigits(phone)
  if (digits.startsWith('0') && digits.length === 10) digits = '972' + digits.slice(1)
  return digits
}

/**
 * Returns the "trusted" phone for this user if they are a driver or tenant with a phone
 * already stored in the system. That number is treated as verified for order placement
 * so they can place orders without going through Clerk SMS verification.
 * Returns null if user has no driver/tenant phone in the system.
 */
export async function getTrustedPhoneForUser(userId: string): Promise<{ digits: string; e164: string } | null> {
  const [driver, tenant] = await Promise.all([
    clientNoCdn.fetch<{ phoneNumber?: string; normalizedPhone?: string } | null>(
      `*[_type == "driver" && clerkUserId == $userId][0]{ phoneNumber, normalizedPhone }`,
      { userId }
    ),
    clientNoCdn.fetch<{ ownerPhone?: string; normalizedOwnerPhone?: string } | null>(
      `*[_type == "tenant" && clerkUserId == $userId && (defined(ownerPhone) && ownerPhone != "" || defined(normalizedOwnerPhone) && normalizedOwnerPhone != "")][0]{ ownerPhone, normalizedOwnerPhone }`,
      { userId }
    ),
  ])
  if (driver?.phoneNumber || driver?.normalizedPhone) {
    const raw = driver.normalizedPhone || driver.phoneNumber || ''
    const digits = normalizeForComparison(raw)
    if (digits) {
      const e164 = digits.startsWith('+') ? digits : `+${digits}`
      return { digits, e164 }
    }
  }
  if (tenant?.ownerPhone || tenant?.normalizedOwnerPhone) {
    const raw = tenant.normalizedOwnerPhone || tenant.ownerPhone || ''
    const digits = normalizeForComparison(raw)
    if (digits) {
      const e164 = digits.startsWith('+') ? digits : `+${digits}`
      return { digits, e164 }
    }
  }
  return null
}

/**
 * Returns the list of verified phone numbers for the user (digits-only normalized).
 * Includes the driver/tenant trusted phone so they can place orders without Clerk verification.
 * Returns [] if user not found or has no verified or trusted phones.
 */
export async function getVerifiedPhoneNumbers(userId: string): Promise<string[]> {
  const trusted = await getTrustedPhoneForUser(userId)
  const trustedList = trusted ? [trusted.digits] : []

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const verified: string[] = []
  for (const pn of user.phoneNumbers ?? []) {
    const status = (pn as { verification?: { status?: string } | null }).verification?.status
    if (status === 'verified' && (pn as { phoneNumber?: string }).phoneNumber) {
      verified.push(normalizePhoneDigits((pn as { phoneNumber: string }).phoneNumber))
    }
  }

  const combined = [...trustedList, ...verified]
  return [...new Set(combined)]
}

/** Check if the given customer phone (raw input) matches one of the user's verified or trusted phones. */
export async function isVerifiedPhoneForUser(userId: string, customerPhoneRaw: string): Promise<boolean> {
  const normalized = normalizeForComparison(customerPhoneRaw)
  if (!normalized) return false
  const verified = await getVerifiedPhoneNumbers(userId)
  return verified.some((v) => v === normalized || v.endsWith(normalized) || normalized.endsWith(v))
}
