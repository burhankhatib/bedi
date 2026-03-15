import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendCustomerOrderStatusPush } from '@/lib/customer-order-push'
import { sendTenantOrderUpdatePush } from '@/lib/tenant-order-push'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** POST - Driver confirms a manual assignment. Sets driverAcceptedAt, clears manualAssignmentAt. */
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
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  const order = await client.fetch<{
    _id: string
    assignedDriverRef?: string
    manualAssignmentAt?: string
  } | null>(
    `*[_type == "order" && _id == $orderId][0]{
      _id,
      "assignedDriverRef": assignedDriver._ref,
      manualAssignmentAt
    }`,
    { orderId }
  )
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.assignedDriverRef !== driver._id) {
    return NextResponse.json({ error: 'Order is not assigned to you' }, { status: 403 })
  }
  if (!order.manualAssignmentAt) {
    return NextResponse.json({ error: 'Order does not need confirmation' }, { status: 400 })
  }

  await writeClient
    .patch(orderId)
    .set({ driverAcceptedAt: new Date().toISOString() })
    .unset(['manualAssignmentAt'])
    .commit()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL

  sendCustomerOrderStatusPush({
    orderId,
    newStatus: 'waiting_for_delivery',
    baseUrl,
  }).catch((e) => console.warn('[confirm-assignment] customer push', e))

  sendTenantOrderUpdatePush({
    orderId,
    status: 'waiting_for_delivery',
    baseUrl,
  }).catch((e) => console.warn('[confirm-assignment] tenant push', e))

  return NextResponse.json({ success: true })
}
