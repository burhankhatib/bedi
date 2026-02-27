import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { getClerkUserByEmail } from '@/lib/getClerkUserByEmail'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export const dynamic = 'force-dynamic'

/** POST: Assign a business to a new owner by email (Super Admin only). Body: { businessTenantId, newOwnerEmail } */
export async function POST(req: NextRequest) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { businessTenantId?: string; newOwnerEmail?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const tenantId = typeof body.businessTenantId === 'string' ? body.businessTenantId.trim() : ''
  const newOwnerEmail = typeof body.newOwnerEmail === 'string' ? body.newOwnerEmail.trim().toLowerCase() : ''
  if (!tenantId || !newOwnerEmail) {
    return NextResponse.json(
      { error: 'Missing required fields: businessTenantId, newOwnerEmail' },
      { status: 400 }
    )
  }

  const tenant = await writeClient.fetch<{ _id: string } | null>(
    `*[_type == "tenant" && _id == $id][0]{ _id }`,
    { id: tenantId }
  )
  if (!tenant) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const newOwner = await getClerkUserByEmail(newOwnerEmail)
  if (!newOwner) {
    return NextResponse.json(
      { error: 'New owner not found. They must be registered on the website with this email.' },
      { status: 400 }
    )
  }

  await writeClient.patch(tenantId).set({
    clerkUserId: newOwner.id,
    clerkUserEmail: newOwner.email,
  }).commit()

  return NextResponse.json({
    ok: true,
    message: 'Business assigned. Previous owner no longer has access.',
  })
}
