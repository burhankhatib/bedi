import { distanceKm } from '@/lib/maps-utils'

export const ATTENDANCE_RADIUS_METERS = 50

export function computeDistanceMeters(
  business: { lat: number; lng: number },
  actor: { lat: number; lng: number }
): number {
  return Math.round(distanceKm(business, actor) * 1000)
}

export function isWithinAttendanceRadius(
  business: { lat: number; lng: number },
  actor: { lat: number; lng: number }
): { within: boolean; distanceMeters: number } {
  const distanceMeters = computeDistanceMeters(business, actor)
  return { within: distanceMeters <= ATTENDANCE_RADIUS_METERS, distanceMeters }
}

export function coerceLatLng(input: unknown): { lat: number; lng: number } | null {
  if (!input || typeof input !== 'object') return null
  const row = input as Record<string, unknown>
  const lat = Number(row.lat)
  const lng = Number(row.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

