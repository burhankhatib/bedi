import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { getTenantIdBySlug } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

/** Use fresh data (no CDN) so customer sees status updates in real time. */
const freshClient = client.withConfig({ useCdn: false })

/** GET: Fetch order for customer tracking by secret token. No phone required. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  const { slug, token } = await params
  if (!token?.trim()) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 })
  }

  const tenantId = await getTenantIdBySlug(slug)
  if (!tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const order = await freshClient.fetch<{
    _id: string
    orderNumber?: string
    orderType?: string
    status?: string
    customerName?: string
    tableNumber?: string
    customerPhone?: string
    deliveryAddress?: string
    deliveryFee?: number
    items?: Array<{ productName?: string; quantity?: number; price?: number; total?: number; notes?: string; addOns?: string }>
    subtotal?: number
    totalAmount?: number
    currency?: string
    createdAt?: string
    preparedAt?: string | null
    driverAcceptedAt?: string | null
    driverPickedUpAt?: string | null
    cancelledAt?: string | null
    driverCancelledAt?: string | null
    completedAt?: string | null
    tipPercent?: number
    tipAmount?: number
    customerRequestedAt?: string | null
    customerRequestAcknowledgedAt?: string | null
    estimatedDeliveryMinutes?: number | null
    scheduledFor?: string | null
    scheduleEditHistory?: Array<{
      previousScheduledFor: string
      changedAt: string
    }>
    site?: { _ref?: string }
    assignedDriver?: { _ref?: string } | null
  } | null>(
    `*[_type == "order" && site._ref == $tenantId && trackingToken == $trackingToken][0]{
      _id,
      orderNumber,
      orderType,
      status,
      customerName,
      tableNumber,
      customerPhone,
      deliveryAddress,
      deliveryFee,
      items,
      subtotal,
      totalAmount,
      currency,
      createdAt,
      preparedAt,
      driverAcceptedAt,
      driverPickedUpAt,
      cancelledAt,
      driverCancelledAt,
      completedAt,
      tipPercent,
      tipAmount,
      customerRequestedAt,
      customerRequestAcknowledgedAt,
      estimatedDeliveryMinutes,
      scheduledFor,
      scheduleEditHistory,
      "site": site,
      "assignedDriver": assignedDriver
    }`,
    { tenantId, trackingToken: token }
  )

  if (!order || order.site?._ref !== tenantId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const driverRef = order.assignedDriver?._ref
  let driver: { _id: string; name: string; phoneNumber: string } | null = null
  if (driverRef) {
    driver = await freshClient.fetch<{ _id: string; name: string; phoneNumber: string } | null>(
      `*[_type == "driver" && _id == $driverId][0]{ _id, name, phoneNumber }`,
      { driverId: driverRef }
    )
  }

  const restaurantInfo = await freshClient.fetch<{
    name_en?: string
    name_ar?: string
    socials?: { whatsapp?: string }
  } | null>(
    `*[_type == "restaurantInfo" && site._ref == $tenantId][0]{ name_en, name_ar, socials }`,
    { tenantId }
  )

  const tenant = await freshClient.fetch<{ country?: string; city?: string } | null>(
    `*[_type == "tenant" && _id == $tenantId][0]{ country, city }`,
    { tenantId }
  )

  return NextResponse.json({
    order: {
      _id: order._id,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      status: order.status,
      customerName: order.customerName,
      tableNumber: order.tableNumber,
      customerPhone: order.customerPhone,
      deliveryAddress: order.deliveryAddress,
      deliveryFee: order.deliveryFee,
      items: order.items,
      subtotal: order.subtotal,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt: order.createdAt,
      preparedAt: order.preparedAt ?? null,
      driverAcceptedAt: order.driverAcceptedAt ?? null,
      driverPickedUpAt: order.driverPickedUpAt ?? null,
      cancelledAt: order.cancelledAt ?? null,
      driverCancelledAt: order.driverCancelledAt ?? null,
      completedAt: order.completedAt,
      tipPercent: order.tipPercent,
      tipAmount: order.tipAmount,
      customerRequestedAt: order.customerRequestedAt ?? null,
      customerRequestAcknowledgedAt: order.customerRequestAcknowledgedAt ?? null,
      estimatedDeliveryMinutes: order.estimatedDeliveryMinutes ?? null,
      scheduledFor: order.scheduledFor ?? null,
      scheduleEditHistory: order.scheduleEditHistory ?? [],
    },
    restaurant: restaurantInfo
      ? {
          name_en: restaurantInfo.name_en,
          name_ar: restaurantInfo.name_ar,
          whatsapp: restaurantInfo.socials?.whatsapp,
        }
      : null,
    driver,
    country: tenant?.country ?? undefined,
  },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  )
}
