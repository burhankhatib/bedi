import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendTenantOrderUpdatePush } from '@/lib/tenant-order-push'
import { sendCustomerOrderStatusPush } from '@/lib/customer-order-push'
import { scheduleDeliveryLifecycleJobs } from '@/lib/delivery-job-scheduler'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** POST - Driver declines a manual assignment. Unassigns, adds to declinedByDriverIds, order goes back to pool. */
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
    declinedByDriverRefs?: string[]
  } | null>(
    `*[_type == "order" && _id == $orderId][0]{
      _id,
      "assignedDriverRef": assignedDriver._ref,
      "declinedByDriverRefs": declinedByDriverIds[]._ref
    }`,
    { orderId }
  )
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.assignedDriverRef !== driver._id) {
    return NextResponse.json({ error: 'Order is not assigned to you' }, { status: 403 })
  }

  const existingRefs = order.declinedByDriverRefs ?? []
  const newRefs = [...existingRefs]
  if (!newRefs.includes(driver._id)) {
    newRefs.push(driver._id)
  }

  const now = new Date().toISOString()

  await writeClient
    .patch(orderId)
    .set({
      status: 'preparing',
      deliveryRequestedAt: now,
      declinedByDriverIds: newRefs.map((_ref) => ({ _type: 'reference', _ref })),
      driverDeclinedAssignmentAt: now,
    })
    .unset(['assignedDriver', 'manualAssignmentAt', 'driverAcceptedAt'])
    .commit()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL

  sendCustomerOrderStatusPush({
    orderId,
    newStatus: 'preparing',
    baseUrl,
  }).catch((e) => console.warn('[decline-assignment] customer push', e))

  sendTenantOrderUpdatePush({
    orderId,
    status: 'preparing',
    baseUrl,
    customTitle: 'السائق رفض التعيين',
    customBody: 'رفض السائق الطلب. تم إرساله مرة أخرى لجميع السائقين المتاحين.',
  }).catch((e) => console.warn('[decline-assignment] tenant push', e))

  const { notifyDriversOfDeliveryOrder } = await import('@/lib/notify-drivers-for-order')
  await notifyDriversOfDeliveryOrder(orderId).catch((e) => console.warn('[notify-drivers]', e))
  await scheduleDeliveryLifecycleJobs(orderId, new Date(now).getTime())

  return NextResponse.json({ success: true })
}
