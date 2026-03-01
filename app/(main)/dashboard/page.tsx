import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { clientNoCdn } from '@/sanity/lib/client'
import { TENANTS_FOR_USER_QUERY, TENANTS_FOR_STAFF_QUERY } from '@/sanity/lib/queries'
import type { Tenant } from '@/lib/tenant'
import { getDriverIdByClerkUserId } from '@/lib/driver'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { DashboardClient } from './DashboardClient'
import { enforcePhoneVerification } from '@/lib/enforce-phone'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SIGN_IN_REDIRECT = '/sign-in?redirect_url=/'

/** Redirect to sign-in so user can log in with the correct credentials. Never show 500 for auth/context failures. */
function redirectToSignIn(): never {
  redirect(SIGN_IN_REDIRECT)
}

/**
 * Routing: mutually exclusive account types.
 * - Driver only (has driver, no tenants) → /driver only; never onboarding.
 * - Tenant (has tenants) → business dashboard only; never /driver.
 * - Neither → onboarding (create business), or /admin for super admin only.
 */
export default async function DashboardPage() {
  try {
    let userId: string | null = null
    let sessionClaims: Record<string, unknown> | null = null
    try {
      const authResult = await auth()
      userId = authResult?.userId ?? null
      sessionClaims = (authResult?.sessionClaims as Record<string, unknown> | null) ?? null
    } catch {
      // Any auth() failure (expired session, wrong credentials, Clerk error) → redirect to sign-in
      redirectToSignIn()
    }
    if (!userId) redirectToSignIn()
    const uid = userId as string

    let email = ''
    try {
      email = await getEmailForUser(uid, sessionClaims)
    } catch {
      email = ''
    }
    const showAdmin = isSuperAdminEmail(email)

    let tenants: Tenant[] = []
    let driverId: string | null = null
    try {
      const clerkUserEmailLower = (email || '').trim().toLowerCase()
      const [rawTenants, staffTenants, driverIdResult] = await Promise.all([
        clientNoCdn.fetch<Tenant[] | null>(TENANTS_FOR_USER_QUERY, {
          clerkUserId: uid,
          clerkUserEmailLower: clerkUserEmailLower || undefined,
        }),
        clerkUserEmailLower
          ? clientNoCdn.fetch<Tenant[] | null>(TENANTS_FOR_STAFF_QUERY, { emailLower: clerkUserEmailLower })
          : Promise.resolve(null),
        getDriverIdByClerkUserId(uid),
      ])
      const ownerList = Array.isArray(rawTenants) ? rawTenants : []
      const staffList = Array.isArray(staffTenants) ? staffTenants : []
      const ownerIds = new Set(ownerList.map((t) => t._id))
      const merged = [...ownerList]
      for (const t of staffList) {
        if (!ownerIds.has(t._id)) {
          merged.push(t)
          ownerIds.add(t._id)
        }
      }
      tenants = merged
      driverId = driverIdResult
    } catch (error) {
      console.error('[Dashboard] Failed to fetch user context:', error)
    }

    const hasTenants = tenants.length > 0
    const hasDriver = !!driverId

    // No tenants and no driver → onboarding (or super admin → /admin)
    if (!hasTenants && !hasDriver) {
      if (showAdmin) redirect('/admin')
      redirect('/onboarding')
    }

    // Tenant account: business dashboard only
    await enforcePhoneVerification('/dashboard')
    return <DashboardClient tenants={tenants} showAdmin={showAdmin} hasDriver={hasDriver} />
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err && String((err as { digest?: string }).digest).startsWith('NEXT_REDIRECT')) {
      throw err
    }
    console.error('[Dashboard] Error (redirecting to sign-in):', err)
    redirectToSignIn()
  }
}
