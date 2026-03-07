import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { client } from '@/sanity/lib/client'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const history = await client.fetch(
      `*[_type == "broadcastHistory"] | order(createdAt desc) {
        _id,
        message,
        targets,
        countries,
        cities,
        specificNumbers,
        successfulNumbers,
        failedNumbers,
        sentCount,
        failedCount,
        totalFound,
        errors,
        createdAt
      }`
    )
    return NextResponse.json(history || [])
  } catch (error: any) {
    console.error('[Admin Broadcast History]', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
