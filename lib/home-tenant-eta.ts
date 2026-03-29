/**
 * Prep midpoint from tenant Sanity bucket (e.g. "20-30" → 25 minutes).
 */
export function prepMinutesFromBucket(prepTimeBucket: string | undefined): number {
  if (!prepTimeBucket) return 25
  const parts = prepTimeBucket.split('-').map(Number)
  if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return Math.round((parts[0] + parts[1]) / 2)
  }
  return 25
}

const LARGE_CITY_KEYS = new Set(
  [
    'jerusalem',
    'القدس',
    'ramallah',
    'رام الله',
    'nablus',
    'نابلس',
    'bethlehem',
    'بيت لحم',
    'hebron',
    'الخليل',
  ].map((s) => s.toLowerCase().trim())
)
const SMALL_CITY_KEYS = new Set(
  ['bethany', 'al-eizariya', 'العيزرية', 'jericho', 'اريحا', 'أريحا'].map((s) => s.toLowerCase().trim())
)

/**
 * Driving + last-mile estimate from straight-line km (Haversine).
 * Uses city-sized urban effective speeds; adds a small pickup/handoff buffer at the store.
 */
export function estimateDeliveryTravelMinutes(distKm: number, tenantCity: string | undefined): number {
  const city = (tenantCity ?? '').toLowerCase().trim()
  const speedKmh = LARGE_CITY_KEYS.has(city) ? 22 : SMALL_CITY_KEYS.has(city) ? 26 : 24
  const driveMinutes = (distKm / speedKmh) * 60
  const pickupHandoffBuffer = 2
  const rounded = Math.round(driveMinutes + pickupHandoffBuffer)
  return Math.min(50, Math.max(3, rounded))
}
