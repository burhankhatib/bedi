/**
 * Find a Clerk user by primary email address.
 * Used for ownership transfer: new owner must be registered.
 */
export async function getClerkUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const normalized = (email ?? '').trim().toLowerCase()
  if (!normalized) return null
  try {
    const { clerkClient } = await import('@clerk/nextjs/server')
    const client = await clerkClient()
    const { data } = await client.users.getUserList({
      emailAddress: [normalized],
      limit: 1,
    })
    const user = data?.[0]
    if (!user?.id) return null
    const primaryEmail = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? ''
    return { id: user.id, email: primaryEmail }
  } catch {
    return null
  }
}
