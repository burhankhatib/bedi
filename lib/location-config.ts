/**
 * Location config for homepage discovery.
 * Countries: Jerusalem (instead of Israel) & Palestine per user request.
 * Cities are fetched from Sanity (tenants) or can be extended here.
 */

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
