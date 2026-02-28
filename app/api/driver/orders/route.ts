import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'

const freshClient = client.withConfig({ token: token || undefined, useCdn: false })

/** Orders for driver view. amountToPayTenant = what driver pays to business (total - delivery). Uses fresh read (no CDN) so accept/complete/cancel reflect instantly with Sanity Live. */
type DriverOrderView = {
  orderId: string
  orderNumber: string
  customerName: string
  customerPhone: string
  businessName: string
  businessAddress: string
  /** Arabic address when available (drivers see Arabic UI). */
  businessAddressAr?: string
  /** Google Maps (or similar) link from tenant business profile; opens Maps/Waze when driver taps. */
  businessMapsLink?: string
  businessLocationLat?: number
  businessLocationLng?: number
  city: string
  /** Area name from restaurant (e.g. Shufat). Shown before driver accepts. */
  deliveryAreaName: string
  /** Arabic area name when available. */
  deliveryAreaNameAr?: string
  deliveryAddress: string
  deliveryLat?: number
  deliveryLng?: number
  deliveryFee: number
  totalAmount: number
  amountToPayTenant: number
  currency: string
  status: string
  deliveryRequestedAt?: string
  completedAt?: string
  itemsUpdatedAt?: string
  driverReconfirmedAt?: string
}

export async function GET() {
  let userId: string | null = null
  try {
    const result = await auth()
    userId = result?.userId ?? null
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const driver = await freshClient.fetch<{ _id: string; country?: string; city?: string; isOnline?: boolean; blockedBySuperAdmin?: boolean } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id, country, city, isOnline, blockedBySuperAdmin }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ pending: [], myDeliveries: [], myCompletedToday: [] })
  if (driver.blockedBySuperAdmin) {
    return NextResponse.json({ error: 'Your driver account has been suspended. Contact support.' }, { status: 403 })
  }

  const country = driver.country ?? ''
  const city = driver.city ?? ''
  const driverId = driver._id
  const isOnline = driver.isOnline === true

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const ordersWithSite = await freshClient.fetch<
    Array<{
      _id: string
      orderNumber: string
      customerName?: string
      customerPhone?: string
      deliveryAddress?: string
      deliveryLat?: number
      deliveryLng?: number
      deliveryFee?: number
      totalAmount?: number
      currency?: string
      status: string
      deliveryRequestedAt?: string
      assignedDriverRef?: string
      siteRef?: string
      completedAt?: string
      createdAt?: string
      declinedByDriverRefs?: string[]
      itemsUpdatedAt?: string
      driverReconfirmedAt?: string
      deliveryArea?: { name_en?: string; name_ar?: string } | null
    }>
  >(
    `*[_type == "order" && orderType == "delivery" && status != "cancelled" && status != "refunded" && (
      (defined(deliveryRequestedAt) && deliveryRequestedAt != null && !defined(assignedDriver)) ||
      assignedDriver._ref == $driverId
    )] | order(deliveryRequestedAt desc, createdAt desc) {
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
      deliveryRequestedAt,
      completedAt,
      createdAt,
      itemsUpdatedAt,
      driverReconfirmedAt,
      "assignedDriverRef": assignedDriver._ref,
      "siteRef": site._ref,
      "declinedByDriverRefs": declinedByDriverIds[]._ref,
      "deliveryArea": deliveryArea->{ name_en, name_ar }
    }`,
    { driverId }
  )

  const siteIds = [...new Set((ordersWithSite ?? []).map((o) => o.siteRef).filter(Boolean))] as string[]
  const sitesInArea =
    country && city
      ? await freshClient.fetch<
          Array<{
            _id: string
            name: string
            city: string
            locationLat?: number
            locationLng?: number
            restaurantName: string
            restaurantAddress: string
            restaurantAddressAr: string | null
            restaurantMapsLink: string | null
          }>
        >(
          `*[_type == "tenant" && _id in $siteIds && country == $country && city == $city] {
            _id,
            name,
            city,
            locationLat,
            locationLng,
            "restaurantName": *[_type == "restaurantInfo" && site._ref == ^._id][0].name_en,
            "restaurantAddress": *[_type == "restaurantInfo" && site._ref == ^._id][0].address_en,
            "restaurantAddressAr": *[_type == "restaurantInfo" && site._ref == ^._id][0].address_ar,
            "restaurantMapsLink": *[_type == "restaurantInfo" && site._ref == ^._id][0].mapsLink
          }`,
          { siteIds, country, city }
        )
      : []
  const siteMap = new Map(
    (sitesInArea ?? []).map((s) => [
      s._id,
      {
        businessName: s.restaurantName || s.name,
        businessAddress: s.restaurantAddress || '',
        businessAddressAr: s.restaurantAddressAr && typeof s.restaurantAddressAr === 'string' ? s.restaurantAddressAr : undefined,
        businessMapsLink: s.restaurantMapsLink && typeof s.restaurantMapsLink === 'string' ? s.restaurantMapsLink : undefined,
        businessLocationLat: s.locationLat,
        businessLocationLng: s.locationLng,
        city: s.city || '',
      },
    ])
  )

  const toView = (o: (typeof ordersWithSite)[0]): DriverOrderView => {
    const total = o.totalAmount ?? 0
    const fee = o.deliveryFee ?? 0
    const site = siteMap.get(o.siteRef ?? '')
    const areaName = o.deliveryArea?.name_en || o.deliveryArea?.name_ar || ''
    const areaNameAr = o.deliveryArea?.name_ar || ''
    return {
      orderId: o._id,
      orderNumber: o.orderNumber,
      customerName: o.customerName ?? '',
      customerPhone: o.customerPhone ?? '',
      businessName: site?.businessName ?? 'Business',
      businessAddress: site?.businessAddress ?? '',
      businessAddressAr: site?.businessAddressAr,
      businessMapsLink: site?.businessMapsLink,
      businessLocationLat: site?.businessLocationLat,
      businessLocationLng: site?.businessLocationLng,
      city: site?.city ?? '',
      deliveryAreaName: areaName,
      deliveryAreaNameAr: areaNameAr || undefined,
      deliveryAddress: o.deliveryAddress ?? '',
      deliveryLat: o.deliveryLat,
      deliveryLng: o.deliveryLng,
      deliveryFee: fee,
      totalAmount: total,
      amountToPayTenant: Math.max(0, total - fee),
      currency: o.currency ?? 'ILS',
      status: o.status,
      deliveryRequestedAt: o.deliveryRequestedAt,
      completedAt: o.completedAt,
      itemsUpdatedAt: o.itemsUpdatedAt,
      driverReconfirmedAt: o.driverReconfirmedAt,
    }
  }

  const pending: DriverOrderView[] = []
  const myDeliveries: DriverOrderView[] = []
  const myCompletedToday: DriverOrderView[] = []

  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)
  const startOfTodayISO = startOfToday.toISOString()

  const isOrderWithin24h = (o: (typeof ordersWithSite)[0]) => {
    const orderDate = o.deliveryRequestedAt || o.createdAt
    return !!orderDate && orderDate >= oneDayAgo
  }
  const driverDeclinedOrder = (o: (typeof ordersWithSite)[0]) =>
    Array.isArray(o.declinedByDriverRefs) && o.declinedByDriverRefs.includes(driverId)

  for (const o of ordersWithSite ?? []) {
    if (o.assignedDriverRef !== driverId) {
      if (
        o.status !== 'completed' &&
        o.deliveryRequestedAt &&
        !o.assignedDriverRef &&
        isOnline &&
        country &&
        city &&
        siteMap.get(o.siteRef ?? '') &&
        isOrderWithin24h(o) &&
        !driverDeclinedOrder(o)
      ) {
        pending.push(toView(o))
      }
      continue
    }
    if (o.status === 'completed') {
      if (o.completedAt && o.completedAt >= startOfTodayISO) {
        myCompletedToday.push(toView(o))
      }
      continue
    }
    if (isOrderWithin24h(o)) {
      myDeliveries.push(toView(o))
    }
  }

  return NextResponse.json(
    { pending, myDeliveries, myCompletedToday },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
