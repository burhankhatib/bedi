import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

export const dynamic = 'force-dynamic'

/** GET: List all registered user emails (from Clerk). Super Admin only. For Transfers "New owner" dropdown. */
export async function GET() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { clerkClient } = await import('@clerk/nextjs/server')
    const client = await clerkClient()
    const { data } = await client.users.getUserList({ limit: 500 })
    const emails = new Set<string>()
    for (const user of data || []) {
      const primary = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress
      if (primary) emails.add(primary.trim().toLowerCase())
    }
    return NextResponse.json({ emails: Array.from(emails).sort() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[admin/registered-emails]', e)
    return NextResponse.json({ error: 'Failed to list users', emails: [] }, { status: 500 })
  }
}
