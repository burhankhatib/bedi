import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { triggerPusherEvent } from '@/lib/pusher'

/**
 * POST /api/driver/location
 * Save driver GPS coordinates to Sanity and broadcast via Pusher so the
 * customer tracking page receives real-time position updates without polling.
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

  // Fetch driver _id + their active delivery order(s) in one query
  const driver = await writeClient.fetch<{
    _id: string
    activeOrderIds: string[]
  } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{
      _id,
      "activeOrderIds": *[
        _type == "order" &&
        orderType == "delivery" &&
        assignedDriver._ref == ^._id &&
        status in ["driver_on_the_way", "out-for-delivery"]
      ]._id
    }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  // Persist to Sanity (source of truth)
  await writeClient
    .patch(driver._id)
    .set({
      lastKnownLat: lat,
      lastKnownLng: lng,
      lastLocationAt: new Date().toISOString(),
    })
    .commit()

  // Broadcast real-time GPS to every active delivery via Pusher.
  // Customers subscribed to driver-location-{orderId} receive the update
  // instantly without fetching from Sanity again.
  if (driver.activeOrderIds.length > 0) {
    await Promise.all(
      driver.activeOrderIds.map((orderId) =>
        triggerPusherEvent(`driver-location-${orderId}`, 'location-update', { lat, lng })
      )
    )
  }

  return NextResponse.json({ ok: true, lat, lng })
}
