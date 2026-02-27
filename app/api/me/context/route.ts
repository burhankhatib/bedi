import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getTenantsForUser } from '@/lib/tenant'
import { client } from '@/sanity/lib/client'
import { getEmailForUser } from '@/lib/getClerkEmail'

/** GET /api/me/context — for cross-dashboard switching: tenants (business) and isDriver. */
export async function GET() {
  let userId: string | null = null
  let email = ''
  try {
    const result = await auth()
    userId = result?.userId ?? null
    if (userId) email = await getEmailForUser(userId, result?.sessionClaims as Record<string, unknown> | null)
  } catch {
    return NextResponse.json({ tenants: [], isDriver: false })
  }
  if (!userId) return NextResponse.json({ tenants: [], isDriver: false })

  const [tenants, driver] = await Promise.all([
    getTenantsForUser(userId, email),
    client.fetch<{ _id: string } | null>(
      `*[_type == "driver" && clerkUserId == $userId][0]{ _id }`,
      { userId }
    ),
  ])

  return NextResponse.json(
    {
      tenants: tenants.map((t) => ({ slug: t.slug, name: t.name })),
      isDriver: !!driver?._id,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
