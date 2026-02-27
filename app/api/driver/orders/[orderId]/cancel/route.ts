import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendCustomerOrderStatusPush } from '@/lib/customer-order-push'

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
    })
    .unset(['assignedDriver'])
    .commit()

  sendCustomerOrderStatusPush({
    orderId,
    newStatus: 'preparing',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  }).catch((e) => console.warn('[customer-order-push]', e))

  return NextResponse.json({ success: true })
}
