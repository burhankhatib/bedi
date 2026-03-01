/**
 * Server-only: get verified phone numbers for a Clerk user.
 */
import { clerkClient } from '@clerk/nextjs/server'
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
 * Returns the list of verified phone numbers for the user (digits-only normalized).
 * Returns [] if user not found or has no verified phones.
 */
export async function getVerifiedPhoneNumbers(userId: string): Promise<string[]> {
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const verified: string[] = []
  for (const pn of user.phoneNumbers ?? []) {
    const status = (pn as { verification?: { status?: string } | null }).verification?.status
    if (status === 'verified' && (pn as { phoneNumber?: string }).phoneNumber) {
      verified.push(normalizePhoneDigits((pn as { phoneNumber: string }).phoneNumber))
    }
  }

  return [...new Set(verified)]
}

/** Check if the given customer phone (raw input) matches one of the user's verified phones. */
export async function isVerifiedPhoneForUser(userId: string, customerPhoneRaw: string): Promise<boolean> {
  const normalized = normalizeForComparison(customerPhoneRaw)
  if (!normalized) return false
  const verified = await getVerifiedPhoneNumbers(userId)
  return verified.some((v) => v === normalized || v.endsWith(normalized) || normalized.endsWith(v))
}
