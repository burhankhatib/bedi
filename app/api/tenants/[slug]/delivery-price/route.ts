import { NextRequest, NextResponse } from 'next/server'
import { getTenantBySlug } from '@/lib/tenant'
import { computeDistanceBasedDeliveryFee } from '@/lib/compute-distance-delivery-fee'

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
    freeDeliveryEnabled: tenant.freeDeliveryEnabled === true,
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

  const priced = computeDistanceBasedDeliveryFee(
    {
      locationLat: tenant.locationLat,
      locationLng: tenant.locationLng,
      city: tenant.city,
      deliveryFeeMin: tenant.deliveryFeeMin,
      deliveryFeeMax: tenant.deliveryFeeMax,
    },
    customerLat,
    customerLng
  )
  if (!priced) {
    return NextResponse.json({ error: 'Business location not set' }, { status: 400 })
  }

  return NextResponse.json({
    ...flags,
    distanceKm: priced.distanceKm,
    suggestedFee: priced.fee,
    currency: 'ILS',
    minFee: priced.minFee,
    maxFee: priced.maxFee,
  })
}
