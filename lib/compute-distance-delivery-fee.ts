import { distanceKm } from '@/lib/maps-utils'

/** City lists and distance brackets — single source for checkout `/delivery-price` and home listings. */
const SMALL_CITIES = ['bethany', 'al-eizariya', 'العيزرية', 'jericho', 'اريحا', 'أريحا'] as const
const LARGE_CITIES = [
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
] as const

export type DistanceDeliveryTenantInput = {
  locationLat?: number | null
  locationLng?: number | null
  city?: string | null
  deliveryFeeMin?: number | null
  deliveryFeeMax?: number | null
}

/**
 * Distance-based delivery bracket (before free-delivery / business-paid rules).
 * Matches `GET /api/tenants/[slug]/delivery-price` pricing.
 */
export function computeDistanceBasedDeliveryFee(
  tenant: DistanceDeliveryTenantInput,
  customerLat: number,
  customerLng: number
): { distanceKm: number; fee: number; minFee: number; maxFee: number } | null {
  if (tenant.locationLat == null || tenant.locationLng == null) return null

  const distKm = distanceKm(
    { lat: tenant.locationLat, lng: tenant.locationLng },
    { lat: customerLat, lng: customerLng }
  )

  const minFee = Math.max(10, tenant.deliveryFeeMin ?? Number(process.env.DEFAULT_DELIVERY_FEE_MIN || 10))

  const city = (tenant.city || '').toLowerCase().trim()
  const maxFee =
    tenant.deliveryFeeMax ??
    (LARGE_CITIES.includes(city as (typeof LARGE_CITIES)[number])
      ? 35
      : SMALL_CITIES.includes(city as (typeof SMALL_CITIES)[number])
        ? 30
        : Number(process.env.DEFAULT_DELIVERY_FEE_MAX || 25))

  let rawFee: number

  if (LARGE_CITIES.includes(city as (typeof LARGE_CITIES)[number])) {
    const d = distKm
    if (d <= 1.5) rawFee = 10
    else rawFee = 10 + Math.ceil((d - 1.5) / 0.75) * 5
  } else if (SMALL_CITIES.includes(city as (typeof SMALL_CITIES)[number])) {
    const d = distKm
    if (d <= 1) rawFee = 10
    else rawFee = 10 + Math.ceil((d - 1) / 0.5) * 5
  } else {
    const baseDistance = 1.5
    const extraKmRate = 5
    rawFee = minFee
    if (distKm > baseDistance) {
      rawFee = minFee + (distKm - baseDistance) * extraKmRate
    }
  }

  let fee = Math.round(rawFee / 5) * 5
  fee = Math.max(minFee, Math.min(fee, maxFee))

  return { distanceKm: distKm, fee, minFee, maxFee }
}
