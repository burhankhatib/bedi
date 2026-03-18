/**
 * Driver Items Location Lock — distance check for 50m business radius.
 * Items are locked until the assigned driver is within 50m of the business.
 */

import { distanceKm } from '@/lib/maps-utils'

/** 50 meters in km */
const RADIUS_KM = 0.05

/**
 * Returns true if the driver is within 50m of the business.
 * Use driver's lastKnownLat/Lng and tenant's locationLat/locationLng.
 */
export function isDriverAtBusiness(
  driverLat: number | null | undefined,
  driverLng: number | null | undefined,
  businessLat: number | null | undefined,
  businessLng: number | null | undefined
): boolean {
  if (
    driverLat == null ||
    driverLng == null ||
    businessLat == null ||
    businessLng == null ||
    !Number.isFinite(driverLat) ||
    !Number.isFinite(driverLng) ||
    !Number.isFinite(businessLat) ||
    !Number.isFinite(businessLng)
  ) {
    return false
  }
  const km = distanceKm(
    { lat: driverLat, lng: driverLng },
    { lat: businessLat, lng: businessLng }
  )
  return km <= RADIUS_KM
}
