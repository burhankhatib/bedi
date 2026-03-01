import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { clientNoCdn } from '@/sanity/lib/client'
import { TENANTS_FOR_USER_QUERY } from '@/sanity/lib/queries'
import { getDriverIdByClerkUserId } from '@/lib/driver'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { DriverLayoutClient } from './DriverLayoutClient'
import { enforcePhoneVerification } from '@/lib/enforce-phone'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Bedi Driver',
  manifest: '/driver/manifest.webmanifest',
  icons: {
    icon: '/driversLogo.webp',
    apple: '/driversLogo.webp',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bedi Driver',
  },
}

const DRIVER_SIGN_IN = '/sign-in?redirect_url=/driver'

/** Redirect to sign-in so user can log in with driver credentials. Never show 500 for auth/context failures. */
function redirectToDriverSignIn(): never {
  redirect(DRIVER_SIGN_IN)
}

/**
 * Driver dashboard: only for driver-only accounts. Tenant (business) accounts are redirected to /dashboard.
 */
export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    let userId: string | null = null
    let sessionClaims: Record<string, unknown> | null = null
    try {
      const result = await auth()
      userId = result?.userId ?? null
      sessionClaims = (result?.sessionClaims as Record<string, unknown> | null) ?? null
    } catch {
      // Any auth() failure → redirect to sign-in (user can then open driver dashboard)
      redirectToDriverSignIn()
    }
    if (!userId) redirectToDriverSignIn()

    let email = ''
    try {
      email = await getEmailForUser(userId, sessionClaims)
    } catch {
      // ignore
    }
    const clerkUserEmailLower = (email || '').trim().toLowerCase()

    const [tenants, driverId] = await Promise.all([
      clientNoCdn.fetch<unknown[] | null>(TENANTS_FOR_USER_QUERY, {
        clerkUserId: userId,
        clerkUserEmailLower: clerkUserEmailLower || undefined,
      }),
      getDriverIdByClerkUserId(userId),
    ])
    const hasTenants = Array.isArray(tenants) && tenants.length > 0
    // Only enforce Clerk phone verification when user already has a driver doc (so they can complete profile first).
    if (driverId) {
      await enforcePhoneVerification('/driver')
    }

    if (!driverId) {
      return <DriverLayoutClient hasNoProfileYet>{children}</DriverLayoutClient>
    }

    return <DriverLayoutClient>{children}</DriverLayoutClient>
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err && String((err as { digest?: string }).digest).startsWith('NEXT_REDIRECT')) {
      throw err
    }
    console.error('[Driver layout] Error (redirecting to sign-in):', err)
    redirectToDriverSignIn()
  }
}
