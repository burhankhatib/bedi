import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { sendAdminNotification } from '@/lib/admin-push'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

export const dynamic = 'force-dynamic'

/** GET: Check if current tenant has a pending transfer request (for owner UI). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const authResult = await checkTenantAuth((await params).slug)
  if (!authResult.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: authResult.status })
  }

  const pending = await client.fetch<{ _id: string } | null>(
    `*[_type == "tenantTransferRequest" && tenant._ref == $tenantId && status == "pending"][0]{ _id }`,
    { tenantId: authResult.tenantId }
  )

  return NextResponse.json({ pending: !!pending })
}

/** POST: Current owner requests transfer to new owner by email. Super Admin must approve. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const authResult = await checkTenantAuth((await params).slug)
  if (!authResult.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: authResult.status })
  }
  /* Tenant (and super admin from tenant page) submit a request; Super Admin reviews in Transfers panel. */

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { newOwnerEmail?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const newOwnerEmail = (body.newOwnerEmail ?? '').trim().toLowerCase()
  if (!newOwnerEmail) {
    return NextResponse.json({ error: 'newOwnerEmail is required' }, { status: 400 })
  }

  const tenant = await writeClient.fetch<{ _id: string; clerkUserEmail?: string } | null>(
    `*[_type == "tenant" && _id == $tenantId][0]{ _id, clerkUserEmail }`,
    { tenantId: authResult.tenantId }
  )
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const currentEmail = await getEmailForUser(userId, null)
  if (currentEmail.toLowerCase() === newOwnerEmail) {
    return NextResponse.json({ error: 'New owner email must be different from current owner' }, { status: 400 })
  }

  const existingPending = await writeClient.fetch<{ _id: string } | null>(
    `*[_type == "tenantTransferRequest" && tenant._ref == $tenantId && status == "pending"][0]{ _id }`,
    { tenantId: authResult.tenantId }
  )
  if (existingPending) {
    return NextResponse.json({ error: 'A transfer request is already pending for this business' }, { status: 409 })
  }

  const doc = await writeClient.create({
    _type: 'tenantTransferRequest',
    tenant: { _type: 'reference', _ref: authResult.tenantId },
    requestedByClerkId: userId,
    requestedByEmail: currentEmail || undefined,
    newOwnerEmail,
    status: 'pending',
    createdAt: new Date().toISOString(),
  })

  const tenantName = await writeClient.fetch<{ name?: string } | null>(
    `*[_type == "tenant" && _id == $id][0]{ name }`,
    { id: authResult.tenantId }
  )
  await sendAdminNotification(
    'New Transfer Request',
    `${tenantName?.name ?? 'Business'} requested ownership transfer to ${newOwnerEmail}.`,
    '/admin/transfers'
  )

  return NextResponse.json({
    ok: true,
    requestId: doc._id,
    message: 'Transfer request submitted. Super Admin will review and approve.',
  })
}
