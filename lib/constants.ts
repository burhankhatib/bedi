/** Super admin email — only this user can access /admin and Studio. Do not add other emails. */
export const SUPER_ADMIN_EMAIL = 'burhank@gmail.com'

export function isSuperAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
}

/** Country codes allowed for Tenant and Driver registration. Expand this list when enabling more countries. */
export const ALLOWED_REGISTRATION_COUNTRY_CODES = ['IL', 'PS'] as const
export type AllowedRegistrationCountryCode = (typeof ALLOWED_REGISTRATION_COUNTRY_CODES)[number]

export function isAllowedRegistrationCountry(code: string | null | undefined): code is AllowedRegistrationCountryCode {
  return typeof code === 'string' && ALLOWED_REGISTRATION_COUNTRY_CODES.includes(code as AllowedRegistrationCountryCode)
}

/** Business types offered at sign-up. supportsDineIn: true = show "Dine-in" (table) option; false = only "Receive in Person" (pickup) + Delivery. */
export const BUSINESS_TYPES = [
  { value: 'restaurant', label: 'Restaurant', labelAr: 'مطعم', supportsDineIn: true },
  { value: 'cafe', label: 'Cafe', labelAr: 'مقهى', supportsDineIn: true },
  { value: 'bakery', label: 'Bakery', labelAr: 'مخبز', supportsDineIn: true },
  { value: 'grocery', label: 'Grocery / Market', labelAr: 'بقالة', supportsDineIn: false },
  { value: 'supermarket', label: 'Supermarket', labelAr: 'سوبرماركت', supportsDineIn: false },
  { value: 'greengrocer', label: 'Greengrocer', labelAr: 'خضار وفواكه', supportsDineIn: false },
  { value: 'retail', label: 'Retail / Shop', labelAr: 'متجر', supportsDineIn: false },
  { value: 'pharmacy', label: 'Pharmacy', labelAr: 'صيدلية', supportsDineIn: false },
  { value: 'other', label: 'Other', labelAr: 'أخرى', supportsDineIn: false },
] as const

export type BusinessType = (typeof BUSINESS_TYPES)[number]['value']

/** Whether this business type shows the "Dine-in" (table) order option. Others get "Receive in Person" (pickup) only. */
export function getSupportsDineIn(businessType: string): boolean {
  const entry = BUSINESS_TYPES.find((t) => t.value === businessType)
  return entry ? entry.supportsDineIn : false
}
