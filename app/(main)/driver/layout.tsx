import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { clientNoCdn } from '@/sanity/lib/client'
import { TENANTS_FOR_USER_QUERY } from '@/sanity/lib/queries'
import { getDriverIdByClerkUserId } from '@/lib/driver'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { DriverLayoutClient } from './DriverLayoutClient'
import { enforcePhoneVerification } from '@/lib/enforce-phone'
import { MANIFEST_VERSION } from '@/lib/pwa/constants'

import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Bedi Driver',
  manifest: `/driver/manifest.webmanifest?v=${MANIFEST_VERSION}`,
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

/** Redirect to sign-in so user can log in with driver credentials. Never show 500 for auth/context failures. */
async function redirectToDriverSignIn(): Promise<never> {
  let redirectUrl = '/driver'
  try {
    const headersList = await headers()
    // In Next.js App Router, layout doesn't have direct access to pathname.
    // Try x-invoke-path (Next.js internal) or referer to reconstruct the intended destination.
    const invokePath = headersList.get('x-invoke-path')
    const referer = headersList.get('referer')
    
    if (invokePath && invokePath.startsWith('/driver')) {
      redirectUrl = invokePath
    } else if (referer) {
      const url = new URL(referer)
      if (url.pathname.startsWith('/driver')) {
        redirectUrl = url.pathname + url.search
      }
    }
  } catch {
    // fallback to /driver
  }
  redirect(`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`)
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
      return redirectToDriverSignIn()
    }
    if (!userId) return redirectToDriverSignIn()
    await enforcePhoneVerification('/driver')

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

    if (!driverId) {
      return <DriverLayoutClient hasNoProfileYet>{children}</DriverLayoutClient>
    }

    return <DriverLayoutClient>{children}</DriverLayoutClient>
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err && String((err as { digest?: string }).digest).startsWith('NEXT_REDIRECT')) {
      throw err
    }
    console.error('[Driver layout] Error (redirecting to sign-in):', err)
    return redirectToDriverSignIn()
  }
}
