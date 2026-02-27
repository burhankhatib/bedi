import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { getTenantIdBySlug } from '@/lib/tenant'
import { phonesMatchForOrderLookup } from '@/lib/driver-utils'

export const dynamic = 'force-dynamic'

/** GET: Fetch order for customer tracking. Requires query param phone; order must belong to tenant and customerPhone must match (normalized). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  const { slug, orderId } = await params
  const phoneParam = req.nextUrl.searchParams.get('phone')
  if (!phoneParam?.trim()) {
    return NextResponse.json({ error: 'Phone required' }, { status: 400 })
  }

  const tenantId = await getTenantIdBySlug(slug)
  if (!tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const order = await client.fetch<{
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
    completedAt?: string | null
    site?: { _ref?: string }
    assignedDriver?: { _ref?: string } | null
  } | null>(
    `*[_type == "order" && _id == $orderId && site._ref == $tenantId][0]{
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
      completedAt,
      "site": site,
      "assignedDriver": assignedDriver
    }`,
    { orderId, tenantId }
  )

  if (!order || order.site?._ref !== tenantId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (!phonesMatchForOrderLookup(phoneParam, order.customerPhone ?? '')) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const driverRef = order.assignedDriver?._ref
  let driver: { _id: string; name: string; phoneNumber: string } | null = null
  if (driverRef) {
    driver = await client.fetch<{ _id: string; name: string; phoneNumber: string } | null>(
      `*[_type == "driver" && _id == $driverId][0]{ _id, name, phoneNumber }`,
      { driverId: driverRef }
    )
  }

  const restaurantInfo = await client.fetch<{
    name_en?: string
    name_ar?: string
    socials?: { whatsapp?: string }
  } | null>(
    `*[_type == "restaurantInfo" && site._ref == $tenantId][0]{ name_en, name_ar, socials }`,
    { tenantId }
  )

  const tenant = await client.fetch<{ country?: string; city?: string } | null>(
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
      completedAt: order.completedAt,
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
  })
}
