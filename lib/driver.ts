import { clientNoCdn } from '@/sanity/lib/client'

/**
 * Returns the driver document _id if the given Clerk user has a driver profile, else null.
 * Uses no-CDN so new drivers are recognized immediately for routing (no cache delay).
 */
export async function getDriverIdByClerkUserId(clerkUserId: string): Promise<string | null> {
  if (!clerkUserId) return null
  try {
    const doc = await clientNoCdn.fetch<{ _id: string } | null>(
      `*[_type == "driver" && clerkUserId == $userId][0]{ _id }`,
      { userId: clerkUserId }
    )
    return doc?._id ?? null
  } catch {
    return null
  }
}
