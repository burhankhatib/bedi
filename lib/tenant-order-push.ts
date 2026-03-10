/**
 * Send push to the business (tenant) when order status changes.
 * Also triggers Pusher so the live /orders page updates in real time.
 * Uses stable fallbacks so a missing slug / name never silently drops the push.
 */

import { client } from '@/sanity/lib/client'
import { sendTenantAndStaffPush } from '@/lib/tenant-and-staff-push'
import { pusherServer } from '@/lib/pusher'

export type TenantOrderPushStatus =
  | 'new'
  | 'preparing'
  | 'waiting_for_delivery'
  | 'driver_on_the_way'
  | 'out-for-delivery'
  | 'completed'
  | 'served'
  | 'cancelled'
  | 'refunded'

const MESSAGES: Record<TenantOrderPushStatus, { title: string; body: string }> = {
  new: {
    title: 'طلب جديد',
    body: 'تم استلام طلب جديد وهو بانتظار التحضير.',
  },
  preparing: {
    title: 'قيد التحضير',
    body: 'الطلب الآن قيد التحضير.',
  },
  waiting_for_delivery: {
    title: 'جاهز للتوصيل',
    body: 'الطلب جاهز وبانتظار سائق التوصيل.',
  },
  driver_on_the_way: {
    title: 'تم قبول الطلب',
    body: 'تم قبول طلب التوصيل، السائق في طريقه إلى المتجر لاستلام الطلب.',
  },
  'out-for-delivery': {
    title: 'السائق في طريقه للعميل',
    body: 'السائق في طريقه لتوصيل الطلب إلى العميل.',
  },
  completed: {
    title: 'تم التوصيل',
    body: 'تم تسليم الطلب بنجاح.',
  },
  served: {
    title: 'تم التقديم',
    body: 'تم تقديم الطلب للعميل.',
  },
  cancelled: {
    title: 'تم الإلغاء',
    body: 'تم إلغاء الطلب.',
  },
  refunded: {
    title: 'تم الاسترداد',
    body: 'تم استرداد مبلغ الطلب.',
  },
}

export type SendTenantOrderPushOptions = {
  orderId: string
  status: TenantOrderPushStatus
  /** Optional base URL for orders link (e.g. process.env.NEXT_PUBLIC_APP_URL). */
  baseUrl?: string
  /** Optional override for title (used when driver cancels) */
  customTitle?: string
  /** Optional override for body (used when driver cancels) */
  customBody?: string
}

const noCdnClient = client.withConfig({ useCdn: false })

export async function sendTenantOrderUpdatePush(
  options: SendTenantOrderPushOptions
): Promise<boolean> {
  const { orderId, status, baseUrl = '', customTitle, customBody } = options

  const msg = MESSAGES[status]
  if (!msg) return false

  let siteRef: string | undefined
  let orderNumber: string | undefined
  try {
    const order = await noCdnClient.fetch<{
      orderNumber?: string
      siteRef?: string
    } | null>(
      `*[_type == "order" && _id == $orderId][0]{ orderNumber, "siteRef": site._ref }`,
      { orderId }
    )
    siteRef = order?.siteRef ?? undefined
    orderNumber = order?.orderNumber ?? undefined
  } catch (e) {
    console.warn('[tenant-order-push] failed to fetch order', orderId, e)
    return false
  }

  if (!siteRef) return false

  // Trigger Pusher so the live /orders page updates in real time for ALL status changes
  // (driver accept, pick-up, complete, cancel, tenant status changes, etc.)
  pusherServer
    .trigger(`tenant-${siteRef}`, 'order-update', { orderId, status })
    .catch((e) => console.warn('[tenant-order-push] Pusher trigger failed', e))

  // Fetch tenant metadata for business name and icon — with safe fallbacks
  let businessName = 'المتجر'
  let slug: string | undefined
  try {
    const tenant = await noCdnClient.fetch<{ name?: string; slug?: string } | null>(
      `*[_type == "tenant" && _id == $id][0]{ name, "slug": slug.current }`,
      { id: siteRef }
    )
    if (tenant?.name) businessName = String(tenant.name).trim() || businessName
    slug = tenant?.slug ?? undefined
  } catch (e) {
    console.warn('[tenant-order-push] failed to fetch tenant for', siteRef, e)
  }

  const num = orderNumber ?? orderId.slice(-6)
  const title = customTitle ? `${businessName}: ${customTitle} — #${num}` : `${businessName}: ${msg.title} — #${num}`
  const body = customBody || msg.body
  const base = baseUrl ? baseUrl.replace(/\/$/, '') : ''

  // Build URL — fall back to /orders if slug is unavailable
  const path = slug ? `/t/${slug}/orders` : '/orders'
  const url = `${base}${path}`

  // Icon: use the per-business icon route if slug is available; otherwise generic logo
  const icon = slug ? `${base}/t/${slug}/icon/192` : `${base}/adminslogo.webp`

  const sent = await sendTenantAndStaffPush(siteRef, { title, body, url, icon, dir: 'rtl' })
  if (status === 'driver_on_the_way' && !sent) {
    console.warn('[tenant-order-push] driver_accepted notification not delivered', { orderId, siteRef, orderNumber: num })
  }
  return sent
}
