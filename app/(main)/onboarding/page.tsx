import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { clientNoCdn } from '@/sanity/lib/client'
import { TENANTS_FOR_USER_QUERY } from '@/sanity/lib/queries'
import { getDriverIdByClerkUserId } from '@/lib/driver'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { OnboardingClient } from './OnboardingClient'

export const dynamic = 'force-dynamic'

/**
 * Onboarding: choice between Create business (tenant) and Join as driver.
 * Driver-only users are redirected by layout. Here we show role choice when
 * user has no business and no driver profile, else the create-business form.
 */
export default async function OnboardingPage() {
  const { userId, sessionClaims } = await auth()
  if (!userId) {
    redirect('/sign-in?redirect_url=/onboarding')
  }

  let email = ''
  try {
    email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  } catch {
    // ignore
  }
  const clerkUserEmailLower = (email || '').trim().toLowerCase()

  const [rawTenants, driverId] = await Promise.all([
    clientNoCdn.fetch<unknown[] | null>(TENANTS_FOR_USER_QUERY, {
      clerkUserId: userId,
      clerkUserEmailLower: clerkUserEmailLower || undefined,
    }),
    getDriverIdByClerkUserId(userId),
  ])
  const hasTenants = Array.isArray(rawTenants) && rawTenants.length > 0
  const hasDriver = !!driverId

  return <OnboardingClient showRoleChoice={!hasTenants && !hasDriver} />
}
