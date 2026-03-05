import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const writeClient = client.withConfig({ token, useCdn: false })

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { type, status, archived } = body

    if (!type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 })
    }

    const updates: Record<string, any> = {}

    if (type === 'driver') {
      if (status !== undefined) updates.pendingTaskStatus = status
      if (archived !== undefined) updates.pendingTaskArchived = archived
    } else {
      // report or suspendedContact
      if (status !== undefined) updates.status = status
      if (archived !== undefined) updates.archived = archived
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const updated = await writeClient
      .patch(id)
      .set(updates)
      .commit()

    return NextResponse.json({ ok: true, updated })
  } catch (error: any) {
    console.error('[Admin Task Update]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
