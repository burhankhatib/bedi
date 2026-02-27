/**
 * Send push to the business (tenant) when order status changes to driver-on-the-way or delivered.
 * Used so the business gets Firebase/Web Push for: new order (in orders/route), driver on the way, delivered.
 */

import { client } from '@/sanity/lib/client'
import { sendTenantAndStaffPush } from '@/lib/tenant-and-staff-push'

export type TenantOrderPushStatus = 'driver_on_the_way' | 'out-for-delivery' | 'completed'

const MESSAGES: Record<
  TenantOrderPushStatus,
  { title: string; body: string }
> = {
  driver_on_the_way: {
    title: 'Driver on the way',
    body: 'The driver is on the way to the store to pick up the order.',
  },
  'out-for-delivery': {
    title: 'Driver on the way to customer',
    body: 'The driver is on the way to deliver the order.',
  },
  completed: {
    title: 'Order delivered',
    body: 'The order was delivered successfully.',
  },
}

export type SendTenantOrderPushOptions = {
  orderId: string
  status: TenantOrderPushStatus
  /** Optional base URL for orders link (e.g. process.env.NEXT_PUBLIC_APP_URL). */
  baseUrl?: string
}

/**
 * Send push to the tenant (business) and all staff when order status changes.
 * No-op if push not configured or no subscriptions.
 */
export async function sendTenantOrderUpdatePush(
  options: SendTenantOrderPushOptions
): Promise<boolean> {
  const { orderId, status, baseUrl = '' } = options

  const order = await client.fetch<{
    orderNumber?: string
    siteRef?: string
  } | null>(
    `*[_type == "order" && _id == $orderId][0]{ orderNumber, "siteRef": site._ref }`,
    { orderId }
  )
  if (!order?.siteRef) return false

  const tenant = await client.fetch<{ name?: string; slug?: string } | null>(
    `*[_type == "tenant" && _id == $id][0]{ name, "slug": slug.current }`,
    { id: order.siteRef }
  )
  if (!tenant?.slug) return false

  const msg = MESSAGES[status]
  if (!msg) return false

  const businessName = (tenant.name && String(tenant.name).trim()) || 'Your business'
  const num = order.orderNumber ?? orderId.slice(-6)
  const title = `${businessName}: ${msg.title} — #${num}`
  const body = msg.body
  const path = `/t/${tenant.slug}/orders`
  const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path

  return sendTenantAndStaffPush(order.siteRef, { title, body, url })
}
