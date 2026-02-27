import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'

export const dynamic = 'force-dynamic'

type RequestDoc = {
  _id: string
  status: string
  newOwnerEmail: string
  requestedByEmail?: string
  requestedByClerkId?: string
  createdAt?: string
  reviewedAt?: string
  rejectionReason?: string
  tenantRef?: string
  tenantName?: string
  tenantSlug?: string
}

/** GET: List all transfer requests (Super Admin only). Pending first. */
export async function GET(req: NextRequest) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const list = await client.fetch<RequestDoc[]>(
    `*[_type == "tenantTransferRequest"] | order(status asc, createdAt desc) {
      _id,
      status,
      newOwnerEmail,
      requestedByEmail,
      requestedByClerkId,
      createdAt,
      reviewedAt,
      rejectionReason,
      "tenantRef": tenant._ref,
      "tenantName": tenant->name,
      "tenantSlug": tenant->slug.current
    }`
  )

  return NextResponse.json(list ?? [])
}
