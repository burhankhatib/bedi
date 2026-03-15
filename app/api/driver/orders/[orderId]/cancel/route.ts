import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendCustomerOrderStatusPush } from '@/lib/customer-order-push'
import { sendTenantOrderUpdatePush } from '@/lib/tenant-order-push'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** POST - Driver cancels after accepting. Clears assignedDriver, sets status to preparing, sets deliveryRequestedAt so order reappears for all drivers. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })
  const { orderId } = await params
  const driver = await client.fetch<{ _id: string } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })
  const order = await client.fetch<{ _id: string; assignedDriverRef?: string } | null>(
    `*[_type == "order" && _id == $orderId][0]{ _id, "assignedDriverRef": assignedDriver._ref }`,
    { orderId }
  )
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.assignedDriverRef !== driver._id) return NextResponse.json({ error: 'Order is not assigned to you' }, { status: 403 })
  const now = new Date().toISOString()
  await writeClient
    .patch(orderId)
    .set({
      assignedDriver: undefined,
      status: 'preparing',
      deliveryRequestedAt: now,
      driverCancelledAt: now,
      cancelledByDriver: { _type: 'reference', _ref: driver._id },
    })
    .unset(['assignedDriver'])
    .commit()

  sendCustomerOrderStatusPush({
    orderId,
    newStatus: 'preparing',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  }).catch((e) => console.warn('[customer-order-push]', e))

  sendTenantOrderUpdatePush({
    orderId,
    status: 'preparing',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
    customTitle: 'السائق ألغى التوصيل',
    customBody: 'تم إرسال الطلب مرة أخرى إلى جميع السائقين المتاحين. يمكن لأي سائق قبوله.',
  }).catch((e) => console.warn('[tenant-order-push]', e))

  // Re-ping all available drivers since the order is back in the pool
  const { notifyDriversOfDeliveryOrder } = await import('@/lib/notify-drivers-for-order')
  await notifyDriversOfDeliveryOrder(orderId).catch((e) => console.warn('[notify-drivers]', e))

  return NextResponse.json({ success: true })
}
