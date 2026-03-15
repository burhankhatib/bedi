import { NextRequest, NextResponse } from 'next/server'
import { getTenantBySlug } from '@/lib/tenant'
import { distanceKm } from '@/lib/maps-utils'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = req.nextUrl
  const latStr = searchParams.get('lat')
  const lngStr = searchParams.get('lng')

  const tenant = await getTenantBySlug(slug, { useCdn: false })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  const flags = {
    requiresPersonalShopper: tenant.requiresPersonalShopper === true,
    supportsDriverPickup: tenant.supportsDriverPickup === true,
  }

  // Allow reading tenant delivery flags even before location is selected.
  if (!latStr || !lngStr) {
    return NextResponse.json({
      ...flags,
      distanceKm: null,
      suggestedFee: null,
      currency: 'ILS',
      minFee: null,
      maxFee: null,
    })
  }

  const customerLat = parseFloat(latStr)
  const customerLng = parseFloat(lngStr)

  if (isNaN(customerLat) || isNaN(customerLng)) {
    return NextResponse.json({ error: 'Invalid coordinates', ...flags }, { status: 400 })
  }

  if (tenant.locationLat == null || tenant.locationLng == null) {
    return NextResponse.json({ error: 'Business location not set' }, { status: 400 })
  }

  const distKm = distanceKm(
    { lat: tenant.locationLat, lng: tenant.locationLng },
    { lat: customerLat, lng: customerLng }
  )

  const minFee = Math.max(10, tenant.deliveryFeeMin ?? Number(process.env.DEFAULT_DELIVERY_FEE_MIN || 10)) // Minimum base fee is always 10

  // Smart City-based pricing
  const city = (tenant.city || '').toLowerCase().trim()
  const smallCities = ['bethany', 'al-eizariya', 'العيزرية', 'jericho', 'اريحا', 'أريحا']
  const largeCities = ['jerusalem', 'القدس', 'ramallah', 'رام الله', 'nablus', 'نابلس', 'bethlehem', 'بيت لحم', 'hebron', 'الخليل']
  // Big cities: default max 35 ILS; small cities: 30 ILS; others: 25
  const maxFee = tenant.deliveryFeeMax ?? (
    largeCities.includes(city) ? 35 :
    smallCities.includes(city) ? 30 :
    Number(process.env.DEFAULT_DELIVERY_FEE_MAX || 25)
  )
  
  let rawFee: number

  if (largeCities.includes(city)) {
    // Big cities: 10 ILS for first 1.5 km, then 5 ILS per 0.75 km (max 35 ILS)
    const d = distKm
    if (d <= 1.5) rawFee = 10
    else rawFee = 10 + Math.ceil((d - 1.5) / 0.75) * 5
  } else if (smallCities.includes(city)) {
    // Small cities (Bethany, Jericho): first 1 km = 10 ILS, every extra 0.5 km = 5 ILS (max 30 ILS)
    const d = distKm
    if (d <= 1) rawFee = 10
    else rawFee = 10 + Math.ceil((d - 1) / 0.5) * 5
  } else {
    // Default: base distance + extra per km
    const baseDistance = 1.5
    const extraKmRate = 5
    rawFee = minFee
    if (distKm > baseDistance) {
      const extraDistance = distKm - baseDistance
      rawFee = minFee + (extraDistance * extraKmRate)
    }
  }

  // Round to nearest 5 (10, 15, 20, 25, 30, …)
  let fee = Math.round(rawFee / 5) * 5
  
  // Clamp to [minFee, maxFee] in case rounding pushed it out
  // Make sure min/max themselves are also rounded to nearest 5 if needed, 
  // but we enforce clamping to the allowed range just in case.
  fee = Math.max(minFee, Math.min(fee, maxFee))

  return NextResponse.json({
    ...flags,
    distanceKm: distKm,
    suggestedFee: fee,
    currency: 'ILS', // Can be parameterized per tenant later
    minFee,
    maxFee,
  })
}
