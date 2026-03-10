import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { pusherServer } from '@/lib/pusher'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** POST: Driver removes tip from the total before completing the order. */
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
    status: string
    tipSentToDriver?: boolean
  } | null>(
    `*[_type == "order" && _id == $orderId][0]{
      _id, "assignedDriverRef": assignedDriver._ref, status, tipSentToDriver
    }`,
    { orderId }
  )
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.assignedDriverRef !== driver._id) return NextResponse.json({ error: 'Not your order' }, { status: 403 })
  if (order.status === 'completed') return NextResponse.json({ error: 'Order already completed' }, { status: 400 })

  await writeClient.patch(orderId).set({
    tipRemovedByDriver: true,
    tipSentToDriver: false,
    tipIncludedInTotal: false,
    tipAmount: 0,
    tipPercent: 0,
  }).commit()

  pusherServer
    .trigger(`order-${orderId}`, 'order-update', { type: 'tip-removed-by-driver' })
    .catch(() => {})

  return NextResponse.json({ success: true })
}
