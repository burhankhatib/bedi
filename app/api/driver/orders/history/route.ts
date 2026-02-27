import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'

const freshClient = client.withConfig({ token: token || undefined, useCdn: false })

/** GET driver order history. Optional ?q= for search (order number, customer name, phone). */
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

  const ordersRaw = await freshClient.fetch<
    Array<{
      _id: string
      orderNumber?: string
      customerName?: string
      customerPhone?: string
      deliveryAddress?: string
      deliveryLat?: number
      deliveryLng?: number
      deliveryFee?: number
      totalAmount?: number
      currency?: string
      status: string
      completedAt?: string
      createdAt?: string
      siteRef?: string
    }>
  >(
    `*[_type == "order" && orderType == "delivery" && assignedDriver._ref == $driverId] | order(completedAt desc, createdAt desc) {
      _id,
      orderNumber,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      deliveryFee,
      totalAmount,
      currency,
      status,
      completedAt,
      createdAt,
      "siteRef": site._ref
    }`,
    { driverId }
  )

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

  let orders = (ordersRaw ?? []).map((o) => {
    const site = siteMap.get(o.siteRef ?? '')
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
      totalAmount: o.totalAmount ?? 0,
      amountToPayTenant: Math.max(0, (o.totalAmount ?? 0) - (o.deliveryFee ?? 0)),
      currency: o.currency ?? 'ILS',
      status: o.status,
      completedAt: o.completedAt,
      createdAt: o.createdAt,
    }
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
