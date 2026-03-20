import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'

/** GET /api/driver/analytics — completed delivery orders for the current driver (for analytics: profit, top areas, top businesses). */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const driver = await client.fetch<{ _id: string } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ orders: [] })

  const driverId = driver._id

  const raw = await client.fetch<
    Array<{
      _id: string
      orderNumber: string
      deliveryFee?: number
      tipAmount?: number
      deliveryFeePaidByBusiness?: boolean
      currency?: string
      completedAt?: string
      siteRef?: string
    }>
  >(
    `*[_type == "order" && orderType == "delivery" && status == "completed" && assignedDriver._ref == $driverId] | order(completedAt desc) {
      _id,
      orderNumber,
      deliveryFee,
      tipAmount,
      deliveryFeePaidByBusiness,
      currency,
      completedAt,
      "siteRef": site._ref
    }`,
    { driverId }
  )

  const siteIds = [...new Set((raw ?? []).map((o) => o.siteRef).filter(Boolean))] as string[]

  const sites =
    siteIds.length > 0
      ? await client.fetch<
          Array<{
            _id: string
            name?: string
            restaurantName?: string
          }>
        >(
          `*[_type == "tenant" && _id in $siteIds] {
            _id,
            name,
            "restaurantName": *[_type == "restaurantInfo" && site._ref == ^._id][0].name_en
          }`,
          { siteIds }
        )
      : []

  const siteMap = new Map(sites.map((s) => [s._id, s.restaurantName || s.name || 'Business']))

  const orders = (raw ?? []).map((o) => ({
    _id: o._id,
    orderNumber: o.orderNumber,
    deliveryFee: o.deliveryFee ?? 0,
    tipAmount: o.tipAmount ?? 0,
    deliveryFeePaidByBusiness: o.deliveryFeePaidByBusiness === true,
    currency: o.currency ?? 'ILS',
    completedAt: o.completedAt ?? o._id,
    areaName: '—',
    businessName: o.siteRef ? siteMap.get(o.siteRef) ?? '—' : '—',
  }))

  const businessSponsoredDeliveries = orders.filter((o) => o.deliveryFeePaidByBusiness === true).length

  return NextResponse.json(
    {
      orders,
      summary: {
        totalCompletedDeliveries: orders.length,
        businessSponsoredDeliveries,
        customerPaidDeliveryFeeDeliveries: orders.length - businessSponsoredDeliveries,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
