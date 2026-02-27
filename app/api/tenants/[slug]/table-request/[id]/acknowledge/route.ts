import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'

export const dynamic = 'force-dynamic'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })
const freshClient = client.withConfig({ useCdn: false })

/**
 * PATCH: Acknowledge a standalone table service request (call waiter with no order).
 * Sets acknowledgedAt so the orders page stops showing it and sound stops.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const doc = await freshClient.fetch<{ _id: string; site?: { _ref?: string } } | null>(
    `*[_type == "tableServiceRequest" && _id == $id][0]{ _id, "site": site }`,
    { id }
  )
  if (!doc || doc.site?._ref !== auth.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  await writeClient.patch(id).set({ acknowledgedAt: now }).commit()

  return NextResponse.json({ success: true, acknowledgedAt: now })
}
