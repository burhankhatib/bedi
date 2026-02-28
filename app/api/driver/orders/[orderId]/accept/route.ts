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

  const order = await client.fetch<{ _id: string; status?: string; assignedDriverRef?: string; deliveryRequestedAt?: string } | null>(
    `*[_type == "order" && _id == $orderId][0]{ _id, status, "assignedDriverRef": assignedDriver._ref, deliveryRequestedAt }`,
    { orderId }
  )
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status === 'cancelled' || order.status === 'refunded') {
    return NextResponse.json({ error: 'Order is cancelled or refunded and no longer available' }, { status: 400 })
  }
  if (order.assignedDriverRef) return NextResponse.json({ error: 'Order already assigned to another driver' }, { status: 400 })
  if (!order.deliveryRequestedAt) return NextResponse.json({ error: 'Order is not requesting a driver' }, { status: 400 })
  await writeClient
    .patch(orderId)
    .set({
      assignedDriver: { _type: 'reference', _ref: driver._id },
      status: 'driver_on_the_way',
      driverAcceptedAt: new Date().toISOString(),
      deliveryRequestedAt: undefined,
    })
    .unset(['deliveryRequestedAt'])
    .commit()

  sendCustomerOrderStatusPush({
    orderId,
    newStatus: 'driver_on_the_way',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  }).catch((e) => console.warn('[customer-order-push]', e))

  sendTenantOrderUpdatePush({
    orderId,
    status: 'driver_on_the_way',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  }).catch((e) => console.warn('[tenant-order-push]', e))

  return NextResponse.json({ success: true })
}
