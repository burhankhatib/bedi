/**
 * Location config for homepage discovery.
 * Countries: Jerusalem (instead of Israel) & Palestine per user request.
 * Cities are fetched from Sanity (tenants) or can be extended here.
 */

import { CITY_NAMES_AR } from '@/lib/registration-translations'

export type CountryValue = 'palestine' | 'jerusalem'

export const LOCATION_COUNTRIES: Array<{
  value: CountryValue
  labelEn: string
  labelAr: string
}> = [
  { value: 'palestine', labelEn: 'Palestine', labelAr: 'فلسطين' },
  { value: 'jerusalem', labelEn: 'Jerusalem', labelAr: 'القدس' },
]

/**
 * Maps our CountryValue to Sanity tenant country values.
 * Jerusalem = Israel in the system (tenants use "Israel" or "IL").
 */
export const SANITY_COUNTRY_VALUES: Record<CountryValue, string[]> = {
  palestine: ['palestine', 'Palestine', 'PS', 'Palestinian Territory'],
  jerusalem: ['jerusalem', 'Jerusalem', 'Israel', 'IL'],
}

/** Fallback cities when none from Sanity. Extend as needed. */
export const FALLBACK_CITIES: Record<CountryValue, string[]> = {
  palestine: [
    'Ramallah',
    'Nablus',
    'Bethlehem',
    'Hebron',
    'Gaza',
    'Jenin',
    'Tulkarm',
    'Qalqilya',
    'Salfit',
  ],
  jerusalem: [
    'Jerusalem',
    'East Jerusalem',
  ],
}

/**
 * Maps the customer's selected city (English canonical) to scroll-animation `countries` values in Sanity (`palestine` | `jerusalem`).
 * Used when filtering homepage scroll animations; keep in sync with `scrollAnimation.countries` options.
 */
export function inferScrollRegionFromCity(city: string): 'palestine' | 'jerusalem' | null {
  const t = city.trim()
  if (!t) return null
  const lower = t.toLowerCase()

  const canonicalKey = Object.keys(CITY_NAMES_AR).find((k) => k.toLowerCase() === lower)
  if (canonicalKey === 'Jerusalem') return 'jerusalem'
  if (canonicalKey) return 'palestine'

  for (const name of FALLBACK_CITIES.jerusalem) {
    if (name.toLowerCase() === lower) return 'jerusalem'
  }

  if (lower.includes('jerusalem')) return 'jerusalem'

  return null
}
