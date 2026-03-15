import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'

const freshClient = client.withConfig({ token: token || undefined, useCdn: false })

const ORDER_FIELDS = `_id,
  orderNumber,
  customerName,
  customerPhone,
  deliveryAddress,
  deliveryLat,
  deliveryLng,
  deliveryFee,
  shopperFee,
  totalAmount,
  tipAmount,
  tipPercent,
  currency,
  status,
  completedAt,
  driverCancelledAt,
  createdAt,
  "siteRef": site._ref,
  "assignedDriverRef": assignedDriver._ref,
  "declinedByDriverRefs": declinedByDriverIds[]._ref`

type OrderRow = {
  _id: string
  orderNumber?: string
  customerName?: string
  customerPhone?: string
  deliveryAddress?: string
  deliveryLat?: number
  deliveryLng?: number
  deliveryFee?: number
  shopperFee?: number
  totalAmount?: number
  tipAmount?: number
  tipPercent?: number
  currency?: string
  status: string
  completedAt?: string
  driverCancelledAt?: string
  createdAt?: string
  siteRef?: string
  assignedDriverRef?: string
  declinedByDriverRefs?: string[]
}

/** GET driver order history. Optional ?q= for search (order number, customer name, phone). Includes completed, cancelled, and declined orders. */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const driver = await freshClient.fetch<{ _id: string } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ orders: [] })

  const driverId = driver._id
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim().toLowerCase()

  const [assignedOrCancelledRaw, declinedRaw] = await Promise.all([
    freshClient.fetch<OrderRow[]>(
      `*[_type == "order" && orderType == "delivery" && (assignedDriver._ref == $driverId || cancelledByDriver._ref == $driverId)] | order(coalesce(completedAt, driverCancelledAt) desc, createdAt desc) { ${ORDER_FIELDS} }`,
      { driverId }
    ),
    freshClient.fetch<OrderRow[]>(
      `*[_type == "order" && orderType == "delivery" && status != "cancelled" && status != "refunded" && status != "completed" && status != "served" && $driverId in declinedByDriverIds[]._ref] | order(deliveryRequestedAt desc, createdAt desc) { ${ORDER_FIELDS} }`,
      { driverId }
    ),
  ])

  const ordersRaw = [...(assignedOrCancelledRaw ?? []), ...(declinedRaw ?? [])]

  const siteIds = [...new Set((ordersRaw ?? []).map((o) => o.siteRef).filter(Boolean))] as string[]
  const sites =
    siteIds.length > 0
      ? await freshClient.fetch<
          Array<{
            _id: string
            name: string
            restaurantName: string
            restaurantAddress: string
            restaurantMapsLink: string | null
            city: string
          }>
        >(
          `*[_type == "tenant" && _id in $siteIds] {
            _id,
            name,
            city,
            "restaurantName": *[_type == "restaurantInfo" && site._ref == ^._id][0].name_en,
            "restaurantAddress": *[_type == "restaurantInfo" && site._ref == ^._id][0].address_en,
            "restaurantMapsLink": *[_type == "restaurantInfo" && site._ref == ^._id][0].mapsLink
          }`,
          { siteIds }
        )
      : []
  const siteMap = new Map(
    (sites ?? []).map((s) => [
      s._id,
      {
        businessName: s.restaurantName || s.name,
        businessAddress: s.restaurantAddress ?? '',
        businessMapsLink: s.restaurantMapsLink ?? undefined,
        city: s.city ?? '',
      },
    ])
  )

  const declinedOrderIds = new Set((declinedRaw ?? []).map((o) => o._id))
  let orders = ordersRaw.map((o) => {
    const site = siteMap.get(o.siteRef ?? '')
    const isDriverCancelled = !!o.driverCancelledAt
    const isDriverDeclined = declinedOrderIds.has(o._id)
    const canUndoDecline = isDriverDeclined && !o.assignedDriverRef
    return {
      orderId: o._id,
      orderNumber: o.orderNumber ?? '',
      customerName: o.customerName ?? '',
      customerPhone: o.customerPhone ?? '',
      businessName: site?.businessName ?? 'Business',
      businessAddress: site?.businessAddress ?? '',
      businessMapsLink: site?.businessMapsLink,
      city: site?.city ?? '',
      deliveryAddress: o.deliveryAddress ?? '',
      deliveryLat: o.deliveryLat,
      deliveryLng: o.deliveryLng,
      deliveryFee: o.deliveryFee ?? 0,
      shopperFee: o.shopperFee ?? 0,
      totalAmount: o.totalAmount ?? 0,
      tipAmount: o.tipAmount ?? 0,
      tipPercent: o.tipPercent ?? 0,
      amountToPayTenant: Math.max(0, (o.totalAmount ?? 0) - (o.deliveryFee ?? 0) - (o.shopperFee ?? 0)),
      currency: o.currency ?? 'ILS',
      status: isDriverCancelled ? 'driver_cancelled' : isDriverDeclined ? 'driver_declined' : o.status,
      completedAt: o.completedAt,
      driverCancelledAt: o.driverCancelledAt,
      createdAt: o.createdAt,
      canUndoDecline,
    }
  })
  orders = orders.sort((a, b) => {
    const dateA = a.completedAt || a.driverCancelledAt || a.createdAt || ''
    const dateB = b.completedAt || b.driverCancelledAt || b.createdAt || ''
    return new Date(dateB).getTime() - new Date(dateA).getTime()
  })

  if (q) {
    orders = orders.filter((o) => {
      const num = String(o.orderNumber).toLowerCase()
      const name = String(o.customerName).toLowerCase()
      const phone = String(o.customerPhone).replace(/\s/g, '')
      const qNorm = q.replace(/\s/g, '')
      return num.includes(q) || name.includes(q) || phone.includes(qNorm)
    })
  }

  return NextResponse.json(
    { orders },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
