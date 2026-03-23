import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { getTenantIdBySlug } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

/** GET: Fetch order for customer tracking. Requires Clerk session. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  const { slug, orderId } = await params
  
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = await getTenantIdBySlug(slug)
  if (!tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const order = await client.fetch<{
    _id: string
    trackingToken?: string
    orderNumber?: string
    orderType?: string
    status?: string
    customerName?: string
    tableNumber?: string
    customerPhone?: string
    deliveryAddress?: string
    deliveryFee?: number
    deliveryFeePaidByBusiness?: boolean
    items?: Array<{ productName?: string; quantity?: number; price?: number; total?: number; notes?: string; addOns?: string }>
    subtotal?: number
    totalAmount?: number
    currency?: string
    createdAt?: string
    completedAt?: string | null
    driverPickedUpAt?: string | null
    estimatedDeliveryMinutes?: number | null
    driverArrivedAt?: string | null
    site?: { _ref?: string }
    assignedDriver?: { _ref?: string } | null
    customer?: { clerkUserId?: string }
  } | null>(
    `*[_type == "order" && _id == $orderId && site._ref == $tenantId][0]{
      _id,
      trackingToken,
      orderNumber,
      orderType,
      status,
      customerName,
      tableNumber,
      customerPhone,
      deliveryAddress,
      deliveryFee,
      deliveryFeePaidByBusiness,
      items,
      subtotal,
      totalAmount,
      currency,
      createdAt,
      completedAt,
      driverPickedUpAt,
      estimatedDeliveryMinutes,
      driverArrivedAt,
      "site": site,
      "assignedDriver": assignedDriver,
      customer->{ clerkUserId }
    }`,
    { orderId, tenantId }
  )

  if (!order || order.site?._ref !== tenantId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.customer?.clerkUserId !== userId) {
    return NextResponse.json({ error: 'Unauthorized order access' }, { status: 403 })
  }

  const driverRef = order.assignedDriver?._ref
  const { driverDoc, restaurantInfo, tenant } = await client.fetch<{
    driverDoc: { _id: string; name: string; nickname?: string; phoneNumber: string } | null
    restaurantInfo: { name_en?: string; name_ar?: string; socials?: { whatsapp?: string } } | null
    tenant: { country?: string; city?: string; name?: string; name_ar?: string; ownerPhone?: string } | null
  }>(
    `{
      "driverDoc": *[_type == "driver" && _id == $driverId][0]{ _id, name, nickname, phoneNumber },
      "restaurantInfo": *[_type == "restaurantInfo" && site._ref == $tenantId][0]{ name_en, name_ar, socials },
      "tenant": *[_type == "tenant" && _id == $tenantId][0]{ country, city, name, name_ar, ownerPhone }
    }`,
    { tenantId, driverId: driverRef ?? 'none' }
  )
  const driver = driverDoc
    ? { _id: driverDoc._id, name: (driverDoc.nickname && driverDoc.nickname.trim()) || driverDoc.name, phoneNumber: driverDoc.phoneNumber }
    : null

  const profileWhatsapp = restaurantInfo?.socials?.whatsapp?.trim()
  const ownerPhone = tenant?.ownerPhone?.trim()
  const businessContactPhone = profileWhatsapp || ownerPhone
  const restaurantPayload =
    restaurantInfo || businessContactPhone
      ? {
          name_en: restaurantInfo?.name_en ?? tenant?.name,
          name_ar: restaurantInfo?.name_ar ?? tenant?.name_ar ?? tenant?.name,
          ...(businessContactPhone ? { whatsapp: businessContactPhone } : {}),
        }
      : null

  return NextResponse.json({
    order: {
      _id: order._id,
      trackingToken: order.trackingToken,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      status: order.status,
      customerName: order.customerName,
      tableNumber: order.tableNumber,
      customerPhone: order.customerPhone,
      deliveryAddress: order.deliveryAddress,
      deliveryFee: order.deliveryFee,
      deliveryFeePaidByBusiness: order.deliveryFeePaidByBusiness ?? false,
      items: order.items,
      subtotal: order.subtotal,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt: order.createdAt,
      completedAt: order.completedAt,
      driverPickedUpAt: order.driverPickedUpAt ?? null,
      estimatedDeliveryMinutes: order.estimatedDeliveryMinutes ?? null,
      driverArrivedAt: order.driverArrivedAt ?? null,
    },
    restaurant: restaurantPayload,
    driver,
    country: tenant?.country ?? undefined,
  })
}
