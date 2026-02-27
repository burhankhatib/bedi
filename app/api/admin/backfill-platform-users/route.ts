import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/backfill-platform-users
 * One-time backfill: create platformUser documents for every Clerk user who has
 * a tenant and/or driver but no platformUser yet. Super admin only.
 * Run once after deploying the platformUser schema (e.g. from browser or curl).
 */
export async function POST() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!token) {
    return NextResponse.json({ error: 'SANITY_API_TOKEN required for backfill' }, { status: 500 })
  }

  try {
    const [tenantUsers, driverUsers, existingPlatformUsers] = await Promise.all([
      client.fetch<{ clerkUserId: string }[]>(
        `*[_type == "tenant" && defined(clerkUserId)]{ "clerkUserId": clerkUserId }`
      ),
      client.fetch<{ clerkUserId: string }[]>(
        `*[_type == "driver" && defined(clerkUserId)]{ "clerkUserId": clerkUserId }`
      ),
      client.fetch<{ clerkUserId: string }[]>(
        `*[_type == "platformUser"]{ clerkUserId }`
      ),
    ])

    const tenantSet = new Set(tenantUsers?.map((t) => t.clerkUserId).filter(Boolean) ?? [])
    const driverSet = new Set(driverUsers?.map((d) => d.clerkUserId).filter(Boolean) ?? [])
    const existingSet = new Set(existingPlatformUsers?.map((p) => p.clerkUserId).filter(Boolean) ?? [])

    const allUserIds = new Set([...tenantSet, ...driverSet])
    const toCreate = [...allUserIds].filter((id) => !existingSet.has(id))

    let created = 0
    for (const clerkUserId of toCreate) {
      try {
        const isTenant = tenantSet.has(clerkUserId)
        const isDriver = driverSet.has(clerkUserId)
        const accountType = isTenant ? 'tenant' : isDriver ? 'driver' : 'tenant'
        await writeClient.create({
          _type: 'platformUser',
          clerkUserId,
          accountType,
          isTenant,
          isDriver: isDriver || false,
        })
        created++
      } catch (e) {
        console.warn('[backfill-platform-users] Skip create for', clerkUserId, e)
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Backfill complete. Created ${created} platformUser document(s).`,
      created,
      totalTenantUsers: tenantSet.size,
      totalDriverUsers: driverSet.size,
      alreadyHadPlatformUser: existingSet.size,
    })
  } catch (e) {
    console.error('[backfill-platform-users] Error:', e)
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 })
  }
}
