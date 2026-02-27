import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { getClerkUserByEmail } from '@/lib/getClerkUserByEmail'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export const dynamic = 'force-dynamic'

/** POST: Approve transfer (Super Admin only). Updates tenant owner and marks request approved. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: requestId } = await params
  if (!requestId) return NextResponse.json({ error: 'Missing request id' }, { status: 400 })

  let body: { assignToEmail?: string } = {}
  try {
    body = await req.json().catch(() => ({}))
  } catch {
    body = {}
  }
  const assignToEmail = typeof body.assignToEmail === 'string' ? body.assignToEmail.trim().toLowerCase() : undefined

  const request = await writeClient.fetch<{
    _id: string
    status: string
    tenantRef: string
    newOwnerEmail: string
  } | null>(
    `*[_type == "tenantTransferRequest" && _id == $id][0]{
      _id,
      status,
      "tenantRef": tenant._ref,
      newOwnerEmail
    }`,
    { id: requestId }
  )

  if (!request) return NextResponse.json({ error: 'Transfer request not found' }, { status: 404 })
  if (request.status !== 'pending') {
    return NextResponse.json({ error: 'Request is no longer pending' }, { status: 409 })
  }

  const effectiveEmail = assignToEmail || request.newOwnerEmail
  const newOwner = await getClerkUserByEmail(effectiveEmail)
  if (!newOwner) {
    return NextResponse.json(
      { error: 'New owner not found. They must be registered on the website with this email.' },
      { status: 400 }
    )
  }

  await writeClient.patch(request.tenantRef).set({
    clerkUserId: newOwner.id,
    clerkUserEmail: newOwner.email,
  }).commit()

  await writeClient.patch(requestId).set({
    status: 'approved',
    reviewedByClerkId: userId,
    reviewedAt: new Date().toISOString(),
  }).commit()

  return NextResponse.json({
    ok: true,
    message: 'Ownership transferred. Previous owner no longer has access.',
  })
}
