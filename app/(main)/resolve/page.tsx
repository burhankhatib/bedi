import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { clientNoCdn } from '@/sanity/lib/client'
import { TENANTS_FOR_USER_QUERY } from '@/sanity/lib/queries'
import { getDriverIdByClerkUserId } from '@/lib/driver'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

export const dynamic = 'force-dynamic'

/**
 * Post-sign-in resolver: always send users to homepage so they can choose role.
 * Super admin with no business/driver → /admin. Everyone else → /.
 */
export default async function ResolvePage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in?redirect_url=/')
  }

  let email = ''
  try {
    email = await getEmailForUser(userId, null)
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

  if (isSuperAdminEmail(email) && !hasTenants && !hasDriver) {
    redirect('/admin')
  }

  redirect('/')
}
