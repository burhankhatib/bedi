import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export const dynamic = 'force-dynamic'

/** PATCH: Set blockedBySuperAdmin for a tenant (super admin only). Body: { blocked: boolean } */
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

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  let body: { blocked?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const blocked = body.blocked === true

  const existing = await writeClient.fetch<{ _id: string } | null>(
    `*[_type == "tenant" && _id == $id][0]{ _id }`,
    { id }
  )
  if (!existing) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  await writeClient.patch(id).set({ blockedBySuperAdmin: blocked }).commit()
  return NextResponse.json({ ok: true, blocked })
}
