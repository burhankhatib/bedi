import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { checkTenantAuth } from '@/lib/tenant-auth'

/**
 * GET drivers in the same country+city as the tenant who are registered (have clerkUserId).
 * Used for consistency; tenant drivers list now comes from GET /drivers.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const country = searchParams.get('country') ?? ''
  const city = searchParams.get('city') ?? ''
  if (!country || !city) return NextResponse.json([])

  const list = await client.fetch<
    Array<{ _id: string; name: string; phoneNumber: string; vehicleType?: string }>
  >(
    `*[_type == "driver" && defined(clerkUserId) && country == $country && city == $city] | order(name asc) { _id, name, phoneNumber, vehicleType }`,
    { country, city }
  )
  return NextResponse.json(list ?? [])
}
