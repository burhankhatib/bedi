import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'

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

/**
 * POST - Set deliveryRequestedAt so order appears in drivers' pending list.
 * Push is sent only to drivers who are:
 * 1. Online (isOnline == true)
 * 2. Same country and city as the business (tenant)
 */
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
  const orderStatus = await writeClient.fetch<{ status?: string } | null>(
    `*[_type == "order" && _id == $orderId][0]{ status }`,
    { orderId }
  )
  if (orderStatus?.status === 'cancelled' || orderStatus?.status === 'refunded') {
    return NextResponse.json({ error: 'Cannot request driver for a cancelled or refunded order' }, { status: 400 })
  }
  const now = new Date().toISOString()
  await writeClient.patch(orderId).set({ deliveryRequestedAt: now }).commit()

  // CRITICAL: Notify online drivers in same country/city via FCM or Web Push. Use writeClient (with token) so we can read all drivers.
  const { notifyDriversOfDeliveryOrder } = await import('@/lib/notify-drivers-for-order')
  await notifyDriversOfDeliveryOrder(orderId)

  return NextResponse.json({ success: true })
}
