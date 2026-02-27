import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'

/** POST - Driver declines this delivery. Order stays in pool for others; this driver will not see it again unless the restaurant assigns it to them. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orderId } = await params
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const driver = await client.fetch<{ _id: string } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 403 })

  const order = await client.fetch<{ _id: string; declinedByDriverRefs?: string[] } | null>(
    `*[_type == "order" && _id == $orderId][0]{ _id, "declinedByDriverRefs": declinedByDriverIds[]._ref }`,
    { orderId }
  )
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const existing = order.declinedByDriverRefs ?? []
  if (existing.includes(driver._id)) return NextResponse.json({ success: true })

  const writeClient = client.withConfig({ token, useCdn: false })
  const newRefs = [...existing, driver._id]
  await writeClient
    .patch(orderId)
    .set({
      declinedByDriverIds: newRefs.map((_ref) => ({ _type: 'reference', _ref })),
    })
    .commit()

  return NextResponse.json({ success: true })
}
