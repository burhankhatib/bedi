import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getFirestoreAdmin } from '@/lib/firebase-admin'

/** List drivers registered in the system (have clerkUserId) in the same country and city as the tenant. Invite-only: tenants cannot add drivers. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const tenant = await client.fetch<{ country?: string; city?: string } | null>(
    `*[_type == "tenant" && _id == $tenantId][0]{ country, city }`,
    { tenantId: auth.tenantId }
  )
  const country = tenant?.country ?? ''
  const city = tenant?.city ?? ''
  if (!country || !city) {
    return NextResponse.json([])
  }

    const drivers = await client.fetch<
    Array<{
      _id: string
      name: string
      nickname?: string
      phoneNumber: string
      vehicleType?: string
      vehicleNumber?: string
      isOnline?: boolean
      isVerifiedByAdmin?: boolean
      picture?: { asset?: { _ref: string } }
      deliveryAreas?: Array<{ _id: string; name_en: string; name_ar: string }>
      lastKnownLat?: number
      lastKnownLng?: number
      lastLocationAt?: string
    }>
  >(
    `*[_type == "driver" && defined(clerkUserId) && country == $country && city == $city] | order(name asc) {
      _id, name, nickname, phoneNumber, vehicleType, vehicleNumber, isOnline, isVerifiedByAdmin,
      "picture": picture,
      "deliveryAreas": deliveryAreas[]->{ _id, name_en, name_ar },
      lastKnownLat, lastKnownLng, lastLocationAt
    }`,
    { country, city }
  )
  return NextResponse.json(drivers ?? [])
}

/** Tenants cannot add drivers; they can only invite drivers to register. */
export async function POST() {
  return NextResponse.json(
    { error: 'Adding drivers is disabled. Invite drivers to register via the "Invite a driver" button.' },
    { status: 405 }
  )
}
