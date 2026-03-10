import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendCustomerOrderStatusPush } from '@/lib/customer-order-push'
import { pusherServer } from '@/lib/pusher'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

const MAX_ARRIVAL_DISTANCE_KM = 0.1

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** POST: Driver confirms arrival at customer location. Must be within 100m. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const { orderId } = await params

  const driver = await client.fetch<{ _id: string; lastKnownLat?: number; lastKnownLng?: number } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id, lastKnownLat, lastKnownLng }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  const order = await client.fetch<{
    _id: string
    assignedDriverRef?: string
    status: string
    deliveryLat?: number
    deliveryLng?: number
    driverArrivedAt?: string
  } | null>(
    `*[_type == "order" && _id == $orderId][0]{
      _id, "assignedDriverRef": assignedDriver._ref, status,
      deliveryLat, deliveryLng, driverArrivedAt
    }`,
    { orderId }
  )
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.assignedDriverRef !== driver._id) return NextResponse.json({ error: 'Not your order' }, { status: 403 })
  if (order.status !== 'out-for-delivery') return NextResponse.json({ error: 'Order is not out for delivery' }, { status: 400 })
  if (order.driverArrivedAt) return NextResponse.json({ success: true, alreadyArrived: true })

  let body: { lat?: number; lng?: number } = {}
  try { body = await req.json() } catch {}

  const driverLat = typeof body.lat === 'number' ? body.lat : driver.lastKnownLat
  const driverLng = typeof body.lng === 'number' ? body.lng : driver.lastKnownLng

  if (driverLat == null || driverLng == null) {
    return NextResponse.json({ error: 'Driver location unavailable' }, { status: 400 })
  }

  if (order.deliveryLat != null && order.deliveryLng != null) {
    const dist = haversineKm(
      { lat: driverLat, lng: driverLng },
      { lat: order.deliveryLat, lng: order.deliveryLng }
    )
    if (dist > MAX_ARRIVAL_DISTANCE_KM) {
      return NextResponse.json(
        { error: 'Too far from customer', distance: Math.round(dist * 1000) },
        { status: 400 }
      )
    }
  }

  const now = new Date().toISOString()
  await writeClient.patch(orderId).set({ driverArrivedAt: now }).commit()

  pusherServer
    .trigger(`order-${orderId}`, 'order-update', { type: 'driver-arrived' })
    .catch(() => {})

  sendCustomerOrderStatusPush({
    orderId,
    newStatus: 'driver-arrived',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  }).catch((e) => console.warn('[customer-order-push] driver-arrived', e))

  return NextResponse.json({ success: true })
}
