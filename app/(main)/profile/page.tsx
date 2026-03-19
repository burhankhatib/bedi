import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { client } from '@/sanity/lib/client'
import { ProfileClient } from './ProfileClient'
import type { MyOrderRow } from '@/app/(main)/my-orders/MyOrdersClient'
import type {
  CustomerProfileApiClerk,
  CustomerProfileApiCustomer,
} from '@/app/api/customer/profile/route'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Profile · Bedi Delivery',
  description: 'Your account, orders, and preferences.',
}

async function getClerkSnapshot(userId: string): Promise<CustomerProfileApiClerk> {
  try {
    const c = await clerkClient()
    const user = await c.users.getUser(userId)
    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null
    const email =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null
    const pid = user.primaryPhoneNumberId
    const ph = user.phoneNumbers.find((p) => p.id === pid)
    const phone = ph?.phoneNumber ?? null
    const phoneVerified = ph?.verification?.status === 'verified'
    return { email, phone, phoneVerified, fullName }
  } catch {
    return {
      email: null,
      phone: null,
      phoneVerified: false,
      fullName: null,
    }
  }
}

export default async function ProfilePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/profile')

  const clerk = await getClerkSnapshot(userId)

  let customer: CustomerProfileApiCustomer | null = null
  let orders: MyOrderRow[] = []

  try {
    customer = await client.fetch<CustomerProfileApiCustomer | null>(
      `*[_type == "customer" && clerkUserId == $userId][0]{
        _id,
        name,
        email,
        primaryPhone,
        orderCount,
        firstOrderAt,
        lastOrderAt,
        blockedBySuperAdmin
      }`,
      { userId }
    )

    if (customer?._id) {
      const list = await client.fetch<MyOrderRow[]>(
        `*[_type == "order" && customer._ref == $customerId] | order(createdAt desc) [0...8] {
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
    customer = null
    orders = []
  }

  return (
    <ProfileClient
      initialCustomer={customer}
      initialClerk={clerk}
      initialOrders={orders}
    />
  )
}
