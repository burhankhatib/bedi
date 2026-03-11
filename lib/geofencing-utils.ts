/**
 * Higher-level geofencing utilities that combine city detection with
 * country inference. Used by driver profile, business manage, etc.
 */

import { getCityFromCoordinates } from './geofencing'

/**
 * Map city → country code.
 * Jerusalem is under 'IL'; all other defined cities are 'PS'.
 */
const CITY_COUNTRY_MAP: Record<string, string> = {
  Jerusalem: 'IL',
  // All others default to PS
}

/**
 * Detect city and country from GPS coordinates using polygon boundaries.
 * @returns `{ city, countryCode }` or `null` if outside all defined polygons.
 */
export function detectCityAndCountry(
  lon: number,
  lat: number
): { city: string; countryCode: string } | null {
  const city = getCityFromCoordinates(lon, lat)
  if (!city) return null
  const countryCode = CITY_COUNTRY_MAP[city] ?? 'PS'
  return { city, countryCode }
}
