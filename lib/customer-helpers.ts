import { clerkClient } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'

const writeClient = client.withConfig({
  token: token || undefined,
  useCdn: false,
})

/** Ensure customer exists for userId; create minimal customer if not (e.g. for AI questions before first order). */
export async function getOrCreateCustomer(userId: string): Promise<string | null> {
  const existing = await writeClient.fetch<{ _id: string } | null>(
    `*[_type == "customer" && clerkUserId == $userId][0]{ _id }`,
    { userId }
  )
  if (existing) return existing._id

  try {
    const clerk = await clerkClient()
    const clerkUser = await clerk.users.getUser(userId)
    const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? ''
    const clerkName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() || undefined

    const created = await writeClient.create({
      _type: 'customer',
      clerkUserId: userId,
      name: clerkName || undefined,
      email: email || undefined,
    })
    return created._id
  } catch (e) {
    console.warn('[customer-helpers] Create customer failed:', e)
    return null
  }
}
