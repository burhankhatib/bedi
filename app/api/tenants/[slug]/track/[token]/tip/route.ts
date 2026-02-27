import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getTenantIdBySlug } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

const freshClient = client.withConfig({ useCdn: false })
const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** PATCH: Update tip for order (customer tracking page). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  const { slug, token: trackingToken } = await params
  if (!trackingToken?.trim()) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 })
  }

  const tenantId = await getTenantIdBySlug(slug)
  if (!tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const order = await freshClient.fetch<{
    _id: string
    site?: { _ref?: string }
  } | null>(
    `*[_type == "order" && site._ref == $tenantId && trackingToken == $trackingToken][0]{ _id, "site": site }`,
    { tenantId, trackingToken }
  )

  if (!order || order.site?._ref !== tenantId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  let body: { tipPercent?: number; tipAmount?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const tipPercent = typeof body.tipPercent === 'number' ? Math.max(0, Math.min(100, body.tipPercent)) : undefined
  const tipAmount = typeof body.tipAmount === 'number' ? Math.max(0, body.tipAmount) : undefined

  if (!token) {
    return NextResponse.json({ error: 'Server config' }, { status: 500 })
  }

  const patch: Record<string, number> = {}
  if (tipPercent !== undefined) patch.tipPercent = tipPercent
  if (tipAmount !== undefined) patch.tipAmount = tipAmount
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: true })
  }

  await writeClient.patch(order._id).set(patch).commit()

  return NextResponse.json({ success: true })
}
