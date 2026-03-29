import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'

/** GET /api/me/orders — orders for the current customer (Clerk user). Returns all orders where customer._ref matches the customer doc for this user. */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customer = await client.fetch<{ _id: string } | null>(
    `*[_type == "customer" && clerkUserId == $userId][0]{ _id }`,
    { userId }
  )
  if (!customer?._id) return NextResponse.json({ orders: [] })

  const orders = await client.fetch<
    Array<{
      _id: string
      orderNumber?: string
      orderType?: string
      status?: string
      totalAmount?: number
      currency?: string
      createdAt?: string
      completedAt?: string
      trackingToken?: string
      siteSlug?: string
      siteName?: string
      siteLogo?: string
    }>
  >(
    `*[_type == "order" && customer._ref == $customerId] | order(createdAt desc) {
      _id,
      orderNumber,
      orderType,
      status,
      totalAmount,
      currency,
      createdAt,
      completedAt,
      trackingToken,
      "siteSlug": site->slug.current,
      "siteName": site->name,
      "siteLogo": site->logo.asset->url
    }`,
    { customerId: customer._id }
  )

  return NextResponse.json({ orders: orders ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}
