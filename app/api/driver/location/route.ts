import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'

/**
 * POST /api/driver/location
 * Save or update the driver's current GPS coordinates.
 * Authenticated via Clerk session (driver must be signed in).
 * Body: { lat: number, lng: number }
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  const lat = typeof body.lat === 'number' ? body.lat : undefined
  const lng = typeof body.lng === 'number' ? body.lng : undefined

  if (lat === undefined || lng === undefined || !isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng (numbers) are required' }, { status: 400 })
  }

  const writeClient = client.withConfig({ token, useCdn: false })
  const driver = await writeClient.fetch<{ _id: string } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  await writeClient
    .patch(driver._id)
    .set({
      lastKnownLat: lat,
      lastKnownLng: lng,
      lastLocationAt: new Date().toISOString(),
    })
    .commit()

  return NextResponse.json({ ok: true, lat, lng })
}
