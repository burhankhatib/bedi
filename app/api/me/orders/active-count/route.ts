import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'

const ACTIVE_STATUSES = ['new', 'preparing', 'waiting_for_delivery', 'driver_on_the_way', 'out-for-delivery']

/** GET /api/me/orders/active-count — number of active orders for the current customer. */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ count: 0 })

  const customer = await client.fetch<{ _id: string } | null>(
    `*[_type == "customer" && clerkUserId == $userId][0]{ _id }`,
    { userId }
  )
  if (!customer?._id) return NextResponse.json({ count: 0 })

  const count = await client.fetch<number>(
    `count(*[_type == "order" && customer._ref == $customerId && status in $activeStatuses])`,
    { customerId: customer._id, activeStatuses: ACTIVE_STATUSES }
  )

  return NextResponse.json({ count: typeof count === 'number' ? count : 0 }, { headers: { 'Cache-Control': 'no-store' } })
}
