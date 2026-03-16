import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { pusherServer } from '@/lib/pusher'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendCustomerOrderStatusPush } from '@/lib/customer-order-push'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })
const freshClient = client.withConfig({ useCdn: false })

/**
 * POST: Driver approves or declines customer's order edit.
 * Body: { action: 'approve' | 'decline' }
 * Only valid when order has customerRequestedItemChanges === true and customerItemChangeStatus === 'pending'.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const { orderId } = await params
  let body: { action?: 'approve' | 'decline' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const action = body.action
  if (!action || !['approve', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve or decline' }, { status: 400 })
  }

  const driver = await freshClient.fetch<{ _id: string } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  const order = await freshClient.fetch<{
    _id: string
    assignedDriverRef?: string
    customerRequestedItemChanges?: boolean
    customerItemChangeStatus?: string
    orderNumber?: string
    trackingToken?: string
    site?: { _ref?: string }
  } | null>(
    `*[_type == "order" && _id == $orderId][0]{
      _id,
      "assignedDriverRef": assignedDriver._ref,
      customerRequestedItemChanges,
      customerItemChangeStatus,
      orderNumber,
      trackingToken,
      "site": site
    }`,
    { orderId }
  )
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.assignedDriverRef !== driver._id) {
    return NextResponse.json({ error: 'Order is not assigned to you' }, { status: 403 })
  }
  if (!order.customerRequestedItemChanges || order.customerItemChangeStatus !== 'pending') {
    return NextResponse.json({ error: 'No pending customer edit to respond to' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const status = action === 'approve' ? 'approved' : 'driver_declined'

  await writeClient
    .patch(orderId)
    .set({
      customerItemChangeStatus: status,
      customerItemChangeResolvedAt: now,
      customerRequestedItemChanges: false,
    })
    .commit()

  pusherServer
    .trigger(`order-${orderId}`, 'order-update', { type: 'driver-customer-edit-response', orderId, status })
    .catch(() => {})
  pusherServer
    .trigger('driver-global', 'order-update', { type: 'driver-customer-edit-response', orderId, status })
    .catch(() => {})

  sendCustomerOrderStatusPush({
    orderId,
    newStatus: action === 'approve' ? 'items_changed' : 'items_change_declined',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  }).catch((e) => console.warn('[customer-order-push]', e))

  return NextResponse.json({ success: true, status })
}
