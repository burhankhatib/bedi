/**
 * Build a WhatsApp click-to-chat URL that works for both personal and Business numbers.
 * WhatsApp requires the number in international format: digits only, no +, no leading zero.
 * Using api.whatsapp.com/send often works more reliably than wa.me when the number
 * is stored in local format (e.g. 0501234567) or for Business accounts.
 */

import { toEnglishDigits } from '@/lib/phone'

/** Default country code when the number is in local format (starts with 0). e.g. 972 for Israel. */
const DEFAULT_COUNTRY_CODE = '972'

/**
 * Normalize a phone number for WhatsApp: digits only (English 0-9), in international format.
 * Converts Arabic/other numerals to English so WhatsApp and tel: links work.
 * If the number has 9–10 digits and starts with 0 (local format), prepend defaultCountryCode.
 */
export function normalizePhoneForWhatsApp(
  phone: string,
  defaultCountryCode: string = DEFAULT_COUNTRY_CODE
): string {
  const digits = (toEnglishDigits(phone || '')).replace(/\D/g, '')
  if (!digits) return ''
  // Local format: e.g. 0501234567 (Israel) -> 972501234567
  if (digits.length >= 9 && digits.length <= 10 && digits.startsWith('0')) {
    return defaultCountryCode + digits.slice(1)
  }
  return digits
}

/**
 * Return WhatsApp chat URL for the given phone and optional pre-filled message.
 * Phone is normalized to international format so it works with personal and Business numbers.
 */
export function getWhatsAppUrl(
  phone: string,
  text?: string,
  defaultCountryCode?: string
): string {
  const num = normalizePhoneForWhatsApp(phone, defaultCountryCode)
  if (!num) return ''
  const base = `https://api.whatsapp.com/send?phone=${num}`
  if (text != null && text !== '') {
    return `${base}&text=${encodeURIComponent(text)}`
  }
  return base
}
