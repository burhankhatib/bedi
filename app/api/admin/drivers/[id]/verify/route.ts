import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const verified = body.verified === true

  try {
    await writeClient
      .patch(id)
      .set({ isVerifiedByAdmin: verified })
      .commit()
    return NextResponse.json({ success: true, isVerifiedByAdmin: verified })
  } catch (error) {
    console.error('[Admin] Verify driver failed:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
