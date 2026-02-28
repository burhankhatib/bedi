import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { sendCustomerOrderStatusPush } from '@/lib/customer-order-push'
import { sendTenantOrderUpdatePush } from '@/lib/tenant-order-push'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

const siteFilter = '(site._ref == $siteId || !defined(site))'

async function checkOrderOwnership(slug: string, orderId: string) {
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return { ok: false as const, status: auth.status }
  const doc = await client.fetch<{ _id: string; site?: { _ref: string } } | null>(
    `*[_type == "order" && _id == $orderId][0]{ _id, site }`,
    { orderId }
  )
  if (!doc) return { ok: false as const, status: 404 }
  // Order belongs to this tenant if site ref matches, or if order has no site (legacy / created before site was set) and appears in tenant list
  if (doc.site?._ref === auth.tenantId) return { ok: true as const, auth, backfillSite: false }
  if (!doc.site) {
    const inTenantList = await client.fetch<{ _id: string } | null>(
      `*[_type == "order" && _id == $orderId && ${siteFilter}][0]{ _id }`,
      { orderId, siteId: auth.tenantId }
    )
    if (inTenantList) return { ok: true as const, auth, backfillSite: true }
  }
  return { ok: false as const, status: 403 }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json()
  const { orderId, status, completedAt, acknowledgeTableRequest } = body
  if (!orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 })
  }

  const check = await checkOrderOwnership(slug, orderId)
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status })

  if (acknowledgeTableRequest === true) {
    const now = new Date().toISOString()
    const updateData: Record<string, unknown> = { customerRequestAcknowledgedAt: now }
    if (check.backfillSite) {
      updateData.site = { _type: 'reference', _ref: check.auth.tenantId }
    }
    await writeClient.patch(orderId).set(updateData).commit()
    return NextResponse.json({ success: true, orderId, acknowledgedTableRequest: true })
  }

  if (!status) {
    return NextResponse.json({ error: 'status required' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = { status }
  if (completedAt != null) updateData.completedAt = completedAt
  if (status === 'preparing' || status === 'waiting_for_delivery') {
    updateData.preparedAt = new Date().toISOString()
  }
  if (status === 'out-for-delivery') {
    updateData.driverPickedUpAt = new Date().toISOString()
  }
  if (check.backfillSite) {
    updateData.site = { _type: 'reference', _ref: check.auth.tenantId }
  }

  await writeClient.patch(orderId).set(updateData).commit()

  sendCustomerOrderStatusPush({
    orderId,
    newStatus: status,
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  }).catch((e) => console.warn('[customer-order-push]', e))

  sendTenantOrderUpdatePush({
    orderId,
    status: status as import('@/lib/tenant-order-push').TenantOrderPushStatus,
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  }).catch((e) => console.warn('[tenant-order-push]', e))

  return NextResponse.json({ success: true, orderId, status })
}
