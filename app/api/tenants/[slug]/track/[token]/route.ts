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
    deliveryFeePaidByBusiness?: boolean
    shopperFee?: number
    items?: Array<{ productName?: string; quantity?: number; price?: number; total?: number; notes?: string; addOns?: string; isPicked?: boolean; notPickedReason?: string; imageUrl?: string }>
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
    tipSentToDriver?: boolean
    tipSentToDriverAt?: string | null
    tipConfirmedAfterCountdown?: boolean
    tipIncludedInTotal?: boolean
    tipRemovedByDriver?: boolean
    driverArrivedAt?: string | null
    customerRequestedAt?: string | null
    customerRequestAcknowledgedAt?: string | null
    estimatedDeliveryMinutes?: number | null
    deliveryLat?: number | null
    deliveryLng?: number | null
    scheduledFor?: string | null
    scheduleEditHistory?: Array<{
      previousScheduledFor: string
      changedAt: string
    }>
    site?: { _ref?: string }
    assignedDriver?: { _ref?: string } | null
    customerItemChangeStatus?: 'pending' | 'approved' | 'contact_requested' | 'driver_declined' | null
    customerItemChangeRequestedAt?: string | null
    customerItemChangeResolvedAt?: string | null
    customerItemChangeResponseNote?: string | null
    customerRequestedItemChanges?: boolean
    customerItemChangePreviousSubtotal?: number
    customerItemChangePreviousTotalAmount?: number
    customerItemChangeSummary?: Array<{
      type?: 'removed' | 'replaced' | 'edited' | 'not_picked'
      fromName?: string
      toName?: string
      fromQuantity?: number
      toQuantity?: number
      note?: string
    }>
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
      deliveryFeePaidByBusiness,
      shopperFee,
      "items": items[]{
        _key,
        "productId": product._ref,
        productName,
        quantity,
        price,
        total,
        notes,
        addOns,
        isPicked,
        notPickedReason,
        "imageUrl": product->image.asset->url
      },
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
      tipSentToDriver,
      tipSentToDriverAt,
      tipConfirmedAfterCountdown,
      tipIncludedInTotal,
      tipRemovedByDriver,
      driverArrivedAt,
      customerRequestedAt,
      customerRequestAcknowledgedAt,
      estimatedDeliveryMinutes,
      scheduledFor,
      scheduleEditHistory,
      customerItemChangeStatus,
      customerItemChangeRequestedAt,
      customerItemChangeResolvedAt,
      customerItemChangeResponseNote,
      customerRequestedItemChanges,
      customerItemChangePreviousSubtotal,
      customerItemChangePreviousTotalAmount,
      customerItemChangeSummary,
      deliveryLat,
      deliveryLng,
      "site": site,
      "assignedDriver": assignedDriver
    }`,
    { tenantId, trackingToken: token }
  )

  if (!order || order.site?._ref !== tenantId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const driverRef = order.assignedDriver?._ref
  let driver: { _id: string; name: string; phoneNumber: string; lat: number | null; lng: number | null; rating?: { averageScore: number; totalCount: number } | null } | null = null
  if (driverRef) {
    const driverDoc = await freshClient.fetch<{
      _id: string
      name: string
      nickname?: string
      phoneNumber: string
      lastKnownLat?: number | null
      lastKnownLng?: number | null
    } | null>(
      `*[_type == "driver" && _id == $driverId][0]{ _id, name, nickname, phoneNumber, lastKnownLat, lastKnownLng }`,
      { driverId: driverRef }
    )
    if (driverDoc) {
      const displayName = (driverDoc.nickname && driverDoc.nickname.trim()) || driverDoc.name
      driver = {
        _id: driverDoc._id,
        name: displayName,
        phoneNumber: driverDoc.phoneNumber,
        lat: driverDoc.lastKnownLat ?? null,
        lng: driverDoc.lastKnownLng ?? null,
      }
      
      // Fetch driver rating from API
      try {
        const port = req.nextUrl.port ? `:${req.nextUrl.port}` : ''
        const host = req.headers.get('host') || `${req.nextUrl.hostname}${port}`
        const protocol = host.includes('localhost') ? 'http' : 'https'
        const res = await fetch(`${protocol}://${host}/api/rating/aggregate?targetId=${driverDoc._id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.aggregate) {
            driver.rating = {
              averageScore: data.aggregate.averageScore,
              totalCount: data.aggregate.totalCount
            }
          }
        }
      } catch (err) {
        console.error('[TrackAPI] Error fetching driver rating:', err)
      }
    }
  }

  const restaurantInfo = await freshClient.fetch<{
    name_en?: string
    name_ar?: string
    socials?: { whatsapp?: string }
  } | null>(
    `*[_type == "restaurantInfo" && site._ref == $tenantId][0]{ name_en, name_ar, socials }`,
    { tenantId }
  )

  const tenant = await freshClient.fetch<{
    country?: string
    city?: string
    locationLat?: number | null
    locationLng?: number | null
  } | null>(
    `*[_type == "tenant" && _id == $tenantId][0]{ country, city, locationLat, locationLng }`,
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
      deliveryFeePaidByBusiness: order.deliveryFeePaidByBusiness ?? false,
      shopperFee: order.shopperFee,
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
      tipSentToDriver: order.tipSentToDriver ?? false,
      tipSentToDriverAt: order.tipSentToDriverAt ?? null,
      tipConfirmedAfterCountdown: order.tipConfirmedAfterCountdown ?? null,
      tipIncludedInTotal: order.tipIncludedInTotal ?? false,
      tipRemovedByDriver: order.tipRemovedByDriver ?? false,
      driverArrivedAt: order.driverArrivedAt ?? null,
      customerRequestedAt: order.customerRequestedAt ?? null,
      customerRequestAcknowledgedAt: order.customerRequestAcknowledgedAt ?? null,
      estimatedDeliveryMinutes: order.estimatedDeliveryMinutes ?? null,
      scheduledFor: order.scheduledFor ?? null,
      scheduleEditHistory: order.scheduleEditHistory ?? [],
      customerItemChangeStatus: order.customerItemChangeStatus ?? null,
      customerItemChangeRequestedAt: order.customerItemChangeRequestedAt ?? null,
      customerItemChangeResolvedAt: order.customerItemChangeResolvedAt ?? null,
      customerItemChangeResponseNote: order.customerItemChangeResponseNote ?? null,
      customerRequestedItemChanges: order.customerRequestedItemChanges ?? false,
      customerItemChangePreviousSubtotal: order.customerItemChangePreviousSubtotal ?? null,
      customerItemChangePreviousTotalAmount: order.customerItemChangePreviousTotalAmount ?? null,
      customerItemChangeSummary: order.customerItemChangeSummary ?? [],
      deliveryLat: order.deliveryLat ?? null,
      deliveryLng: order.deliveryLng ?? null,
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
    businessLocation: (tenant?.locationLat && tenant?.locationLng)
      ? { lat: tenant.locationLat, lng: tenant.locationLng }
      : null,
  },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  )
}
