import { toEnglishDigits } from '@/lib/phone'

/** Normalize phone for deduplication: English digits only (0-9), no spaces/dashes/plus */
export function normalizePhone(phone: string): string {
  return toEnglishDigits(phone || '').replace(/\D/g, '')
}

/**
 * Normalize phone to a canonical form for order lookup so that
 * "0501234567", "972501234567", "+972 50 123 4567" all match.
 * Reduces to local 9 digits (strip country code 972/970 or leading 0) for comparison.
 */
export function normalizePhoneForOrderLookup(phone: string): string {
  const digits = normalizePhone(phone)
  if (!digits) return ''

  // International: 972xxxxxxxxx or 970xxxxxxxxx (12 digits) -> take last 9
  if (digits.length >= 12 && (digits.startsWith('972') || digits.startsWith('970'))) {
    return digits.slice(-9)
  }

  // International: 972 or 970 + 9 digits (11 digits total, e.g. 97250123456)
  if (digits.length === 11 && (digits.startsWith('972') || digits.startsWith('970'))) {
    return digits.slice(-9)
  }

  // Local format: 10 digits starting with 0 (e.g. 0501234567) -> last 9
  if (digits.length === 10 && digits.startsWith('0')) {
    return digits.slice(1)
  }

  // Already 9 digits (local without leading 0)
  if (digits.length === 9) {
    return digits
  }

  return digits
}

/**
 * Return true if two phones match for order lookup (with or without country code).
 */
export function phonesMatchForOrderLookup(requestPhone: string, storedPhone: string): boolean {
  const a = normalizePhoneForOrderLookup(requestPhone)
  const b = normalizePhoneForOrderLookup(storedPhone)
  if (a && b && a === b) return true
  // Fallback: raw digit match (e.g. same format on both sides)
  const rawA = normalizePhone(requestPhone)
  const rawB = normalizePhone(storedPhone)
  return rawA.length > 0 && rawA === rawB
}
