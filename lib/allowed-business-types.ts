import { clientNoCdn } from '@/sanity/lib/client'
import { BUSINESS_TYPES } from '@/lib/constants'

/**
 * Valid tenant.businessType values: legacy constants plus any `businessCategory.value` in Sanity.
 */
export async function getAllowedBusinessTypeValues(): Promise<Set<string>> {
  const set = new Set<string>(BUSINESS_TYPES.map((t) => t.value))
  const fromSanity = await clientNoCdn.fetch<string[] | null>(
    `array::unique(*[_type == "businessCategory" && defined(value) && value != ""].value)`
  )
  for (const v of fromSanity ?? []) {
    if (typeof v === 'string' && v.trim()) set.add(v.trim())
  }
  return set
}

export function isAllowedBusinessType(values: Set<string>, businessType: string): boolean {
  const bt = businessType.trim()
  return bt.length > 0 && values.has(bt)
}
