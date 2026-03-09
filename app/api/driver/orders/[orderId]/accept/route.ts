import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendCustomerOrderStatusPush } from '@/lib/customer-order-push'
import { sendTenantOrderUpdatePush } from '@/lib/tenant-order-push'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** POST - Driver accepts this delivery. Sets assignedDriver and status to out-for-delivery, clears deliveryRequestedAt. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })
  const { orderId } = await params
  const driver = await client.fetch<{ _id: string; isOnline?: boolean } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id, isOnline }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  // Max 2 active deliveries per driver
  const activeCount = await client.fetch<number>(
    `count(*[_type == "order" && orderType == "delivery" && assignedDriver._ref == $driverId && status in ["new", "preparing", "waiting_for_delivery", "driver_on_the_way", "out-for-delivery"]])`,
    { driverId: driver._id }
  )
  if (activeCount >= 2) {
    return NextResponse.json(
      { error: 'You can have at most 2 active deliveries. Complete or cancel one to accept more.' },
      { status: 400 }
    )
  }

  const order = await client.fetch<{ _id: string; status?: string; assignedDriverRef?: string; deliveryRequestedAt?: string; deliveryJourneyLog?: any[] } | null>(
    `*[_type == "order" && _id == $orderId][0]{ _id, status, "assignedDriverRef": assignedDriver._ref, deliveryRequestedAt, deliveryJourneyLog }`,
    { orderId }
  )
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status === 'cancelled' || order.status === 'refunded') {
    return NextResponse.json({ error: 'Order is cancelled or refunded and no longer available' }, { status: 400 })
  }
  if (order.assignedDriverRef) return NextResponse.json({ error: 'Order already assigned to another driver' }, { status: 400 })
  if (!order.deliveryRequestedAt) return NextResponse.json({ error: 'Order is not requesting a driver' }, { status: 400 })

  const driverDoc = await client.fetch<{ lastKnownLat?: number; lastKnownLng?: number } | null>(
    `*[_type == "driver" && _id == $driverId][0]{ lastKnownLat, lastKnownLng }`,
    { driverId: driver._id }
  )

  const newLogEntry = {
    _key: crypto.randomUUID().replace(/-/g, ''),
    at: new Date().toISOString(),
    lat: driverDoc?.lastKnownLat ?? 0,
    lng: driverDoc?.lastKnownLng ?? 0,
    label: 'driver_accepted',
    source: 'driver'
  }
  
  const currentLogs = order.deliveryJourneyLog ?? []

  await writeClient
    .patch(orderId)
    .set({
      assignedDriver: { _type: 'reference', _ref: driver._id },
      status: 'driver_on_the_way',
      driverAcceptedAt: new Date().toISOString(),
      deliveryRequestedAt: undefined,
      deliveryJourneyLog: [...currentLogs, newLogEntry]
    })
    .unset(['deliveryRequestedAt'])
    .commit()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL

  // Notify customer: driver accepted, on the way to store
  const customerPushPromise = sendCustomerOrderStatusPush({
    orderId,
    newStatus: 'driver_on_the_way',
    baseUrl,
  }).catch((e) => {
    console.warn('[driver-accept] customer push failed', e)
    return false
  })

  // Notify business (tenant + staff): driver accepted delivery
  const tenantPushPromise = sendTenantOrderUpdatePush({
    orderId,
    status: 'driver_on_the_way',
    baseUrl,
  }).catch((e) => {
    console.warn('[driver-accept] tenant push failed', e)
    return false
  })

  const [customerSent, tenantSent] = await Promise.all([customerPushPromise, tenantPushPromise])
  if (!tenantSent) {
    console.warn('[driver-accept] tenant push did not deliver (no tokens or send failed). Ensure business has enabled notifications on /t/[slug]/orders.')
  }
  console.info('[driver-accept] orderId=%s customerPush=%s tenantPush=%s', orderId, customerSent, tenantSent)

  return NextResponse.json({ success: true })
}
