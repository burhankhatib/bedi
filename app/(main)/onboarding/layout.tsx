import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getDriverIdByClerkUserId } from '@/lib/driver'
import { client } from '@/sanity/lib/client'
import { TENANTS_FOR_USER_QUERY } from '@/sanity/lib/queries'
import { getEmailForUser } from '@/lib/getClerkEmail'

export const dynamic = 'force-dynamic'

/**
 * If the signed-in user is a driver with NO tenants, send them to the driver dashboard
 * instead of onboarding (driver-only user opening app). If they have tenants, they may
 * be adding another business — let them through to onboarding.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId, sessionClaims } = await auth()
  if (userId) {
    const driverId = await getDriverIdByClerkUserId(userId)
    if (driverId) {
      let email = ''
      try {
        email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
      } catch {
        // ignore
      }
      const clerkUserEmailLower = (email || '').trim().toLowerCase()
      const tenants = (await client.fetch<unknown[]>(TENANTS_FOR_USER_QUERY, {
        clerkUserId: userId,
        clerkUserEmailLower: clerkUserEmailLower || undefined,
      })) ?? []
      if (tenants.length === 0) redirect('/driver')
    }
  }
  return <>{children}</>
}
