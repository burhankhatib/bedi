import { CITY_NAMES_AR } from '@/lib/registration-translations'

/**
 * Canonical English city names used in LocationContext / APIs (Palestine service area).
 * Keep in sync with `/api/cities` fallback for PS and `CITY_NAMES_AR`.
 */
export const PLATFORM_CITY_VALUES = Object.keys(CITY_NAMES_AR).sort((a, b) =>
  a.localeCompare(b, 'en')
)

/** Sanity Studio: dropdown labels (EN — AR) and stored values (English name). */
export const PLATFORM_CITY_OPTIONS = PLATFORM_CITY_VALUES.map((en) => ({
  title: `${en} — ${CITY_NAMES_AR[en]}`,
  value: en,
}))
