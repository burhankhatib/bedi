import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { sendCustomerOrderStatusPush } from '@/lib/customer-order-push'
import { sendTenantOrderUpdatePush } from '@/lib/tenant-order-push'
import { scheduleDeliveryLifecycleJobs } from '@/lib/delivery-job-scheduler'

async function checkOrderOwnership(slug: string, orderId: string) {
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return { ok: false as const, status: auth.status }
  const doc = await client.fetch<{ _id: string; site?: { _ref: string } } | null>(
    `*[_type == "order" && _id == $orderId][0]{ _id, site }`,
    { orderId }
  )
  if (!doc || doc.site?._ref !== auth.tenantId) return { ok: false as const, status: 403 }
  return { ok: true as const }
}

/** POST - Clear assignedDriver and set deliveryRequestedAt so order reappears for drivers. Tenant can then reassign manually. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })
  const body = await req.json().catch(() => ({}))
  const orderId = body.orderId
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })
  const check = await checkOrderOwnership(slug, orderId)
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status })
  const writeClient = client.withConfig({ token, useCdn: false })
  const now = new Date().toISOString()
  await writeClient
    .patch(orderId)
    .set({ status: 'preparing', deliveryRequestedAt: now })
    .unset(['assignedDriver'])
    .commit()
  await scheduleDeliveryLifecycleJobs(orderId, new Date(now).getTime())

  sendCustomerOrderStatusPush({
    orderId,
    newStatus: 'preparing',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  }).catch((e) => console.warn('[customer-order-push]', e))

  sendTenantOrderUpdatePush({
    orderId,
    status: 'preparing',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  }).catch((e) => console.warn('[tenant-order-push]', e))

  return NextResponse.json({ success: true })
}
