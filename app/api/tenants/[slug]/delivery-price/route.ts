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

  if (!latStr || !lngStr) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }

  const customerLat = parseFloat(latStr)
  const customerLng = parseFloat(lngStr)

  if (isNaN(customerLat) || isNaN(customerLng)) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
  }

  const tenant = await getTenantBySlug(slug, { useCdn: false })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  if (tenant.locationLat == null || tenant.locationLng == null) {
    return NextResponse.json({ error: 'Business location not set' }, { status: 400 })
  }

  const distKm = distanceKm(
    { lat: tenant.locationLat, lng: tenant.locationLng },
    { lat: customerLat, lng: customerLng }
  )

  const minFee = tenant.deliveryFeeMin ?? Number(process.env.DEFAULT_DELIVERY_FEE_MIN || 10)
  const maxFee = tenant.deliveryFeeMax ?? Number(process.env.DEFAULT_DELIVERY_FEE_MAX || 25)
  const maxDistanceKm = tenant.deliveryMaxDistanceKm ?? 15

  // Linear formula: fee = minFee + (dist / maxDist) * (maxFee - minFee)
  let rawFee = minFee
  if (distKm > 0) {
    const fraction = Math.min(distKm / maxDistanceKm, 1.0)
    rawFee = minFee + fraction * (maxFee - minFee)
  }

  // Round to nearest 5 (10, 15, 20, 25, 30)
  let fee = Math.round(rawFee / 5) * 5
  
  // Clamp to [minFee, maxFee] in case rounding pushed it out
  // Make sure min/max themselves are also rounded to nearest 5 if needed, 
  // but we enforce clamping to the allowed range just in case.
  fee = Math.max(minFee, Math.min(fee, maxFee))

  return NextResponse.json({
    distanceKm: distKm,
    suggestedFee: fee,
    currency: 'ILS', // Can be parameterized per tenant later
    minFee,
    maxFee
  })
}
