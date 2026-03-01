import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const freshClient = client.withConfig({ useCdn: false })

export const dynamic = 'force-dynamic'

/** GET: List all drivers (super admin only). */
export async function GET() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const drivers = await freshClient.fetch<
    Array<{
      _id: string
      name?: string
      phoneNumber?: string
      country?: string
      city?: string
      isOnline?: boolean
      vehicleType?: string
      isVerifiedByAdmin?: boolean
      blockedBySuperAdmin?: boolean
    }>
  >(
    `*[_type == "driver"] | order(name asc) {
      _id,
      name,
      phoneNumber,
      country,
      city,
      isOnline,
      vehicleType,
      isVerifiedByAdmin,
      blockedBySuperAdmin
    }`
  )

  return NextResponse.json(drivers ?? [])
}
