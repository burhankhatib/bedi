import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { client } from '@/sanity/lib/client'
import { MyOrdersClient, type MyOrderRow } from './MyOrdersClient'

export const dynamic = 'force-dynamic'

export default async function MyOrdersPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/my-orders')

  let orders: MyOrderRow[] = []
  try {
    const customer = await client.fetch<{ _id: string } | null>(
      `*[_type == "customer" && clerkUserId == $userId][0]{ _id }`,
      { userId }
    )
    if (customer?._id) {
      const list = await client.fetch<MyOrderRow[]>(
        `*[_type == "order" && customer._ref == $customerId] | order(createdAt desc) {
          _id,
          orderNumber,
          orderType,
          status,
          totalAmount,
          currency,
          createdAt,
          completedAt,
          scheduledFor,
          trackingToken,
          "siteSlug": site->slug.current,
          "siteName": site->name
        }`,
        { customerId: customer._id }
      )
      orders = list ?? []
    }
  } catch {
    orders = []
  }

  return <MyOrdersClient initialOrders={orders} />
}
