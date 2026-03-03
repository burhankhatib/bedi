import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getTenantIdBySlug } from '@/lib/tenant'
import { sendTenantAndStaffPush } from '@/lib/tenant-and-staff-push'
import { isFCMConfigured } from '@/lib/fcm'
import { isPushConfigured } from '@/lib/push'

import { pusherServer } from '@/lib/pusher'

export const dynamic = 'force-dynamic'

const freshClient = client.withConfig({ useCdn: false })
const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/**
 * POST: Dine-in customer at a table requests a waiter (no order required).
 * Creates a tableServiceRequest doc so the orders page can show it; sends push to tenant and staff.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const tenantId = await getTenantIdBySlug(slug)
  if (!tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: { tableNumber?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const tableNumber = typeof body?.tableNumber === 'string' ? body.tableNumber.trim() : null
  if (!tableNumber) {
    return NextResponse.json({ error: 'tableNumber required' }, { status: 400 })
  }

  const tableExists = await freshClient.fetch<{ _id: string } | null>(
    `*[_type == "tenantTable" && site._ref == $tenantId && tableNumber == $tableNumber][0]{ _id }`,
    { tenantId, tableNumber }
  )
  if (!tableExists) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  if (token) {
    try {
      await writeClient.create({
        _type: 'tableServiceRequest',
        site: { _type: 'reference', _ref: tenantId },
        tableNumber,
        type: 'call_waiter',
        createdAt: now,
      })
      await pusherServer.trigger(`tenant-${tenantId}`, 'order-update', { _type: 'tableServiceRequest' }).catch(() => {})
    } catch (e) {
      console.error('[table-request] Failed to create tableServiceRequest:', e)
      return NextResponse.json({ error: 'Failed to save request' }, { status: 500 })
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const tenant = await freshClient.fetch<{ slug?: string } | null>(
    `*[_type == "tenant" && _id == $id][0]{ "slug": slug.current }`,
    { id: tenantId }
  )
  const tableLabel = `Table ${tableNumber}`
  const path = tenant?.slug ? `/t/${tenant.slug}/orders` : '/orders'
  const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path

  if (isFCMConfigured() || isPushConfigured()) {
    await sendTenantAndStaffPush(tenantId, {
      title: `${tableLabel} needs assistance`,
      body: 'A customer requested a waiter. Tap to open orders.',
      url,
    })
  }

  return NextResponse.json({ success: true })
}
