import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export const dynamic = 'force-dynamic'

/** POST: Reject transfer request (Super Admin only). Body: { reason?: string } */
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

  let body: { reason?: string }
  try {
    body = await req.json().catch(() => ({}))
  } catch {
    body = {}
  }

  const request = await writeClient.fetch<{ _id: string; status: string } | null>(
    `*[_type == "tenantTransferRequest" && _id == $id][0]{ _id, status }`,
    { id: requestId }
  )

  if (!request) return NextResponse.json({ error: 'Transfer request not found' }, { status: 404 })
  if (request.status !== 'pending') {
    return NextResponse.json({ error: 'Request is no longer pending' }, { status: 409 })
  }

  await writeClient.patch(requestId).set({
    status: 'rejected',
    reviewedByClerkId: userId,
    reviewedAt: new Date().toISOString(),
    rejectionReason: (body.reason ?? '').trim() || undefined,
  }).commit()

  return NextResponse.json({ ok: true, message: 'Transfer request rejected.' })
}
