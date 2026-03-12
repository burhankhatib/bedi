import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clientNoCdn } from '@/sanity/lib/client'
import { TENANTS_FOR_USER_QUERY } from '@/sanity/lib/queries'
import { getDriverIdByClerkUserId } from '@/lib/driver'
import { resolveAccountType } from '@/lib/platform-user'
import { getEmailForUser } from '@/lib/getClerkEmail'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me/account-type
 * Returns { accountType: 'driver' | 'tenant' | null } for routing.
 * Uses no-CDN so new drivers/tenants are recognized immediately (middleware + layouts).
 */
export async function GET() {
  let userId: string | null = null
  let email = ''
  try {
    const result = await auth()
    userId = result?.userId ?? null
    if (userId) email = await getEmailForUser(userId, result?.sessionClaims as Record<string, unknown> | null)
  } catch {
    return NextResponse.json({ accountType: null })
  }
  if (!userId) return NextResponse.json({ accountType: null })

  try {
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
    const accountType = resolveAccountType(hasTenants, hasDriver)
    return NextResponse.json(
      { accountType, hasDriver, hasTenants },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json({ accountType: null })
  }
}
