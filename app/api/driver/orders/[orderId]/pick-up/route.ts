import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendCustomerOrderStatusPush } from '@/lib/customer-order-push'
import { sendTenantOrderUpdatePush } from '@/lib/tenant-order-push'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

const EXTRA_BUFFER_MINUTES = 5

async function fetchOsrmDurationMinutes(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<number | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    const data = await res.json()
    if (data.code === 'Ok' && data.routes?.[0]?.duration != null) {
      return Math.ceil(data.routes[0].duration / 60)
    }
  } catch (e) {
    console.warn('[pick-up] OSRM ETA fetch failed, using fallback', e)
  }
  return null
}

/** POST - Driver marks delivery picked up (out-for-delivery). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })
  const { orderId } = await params
  const driver = await client.fetch<{ _id: string; lastKnownLat?: number; lastKnownLng?: number } | null>(
    `*[_type == "driver" && clerkUserId == $userId][0]{ _id, lastKnownLat, lastKnownLng }`,
    { userId }
  )
  if (!driver) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })
  const order = await client.fetch<{
    _id: string
    assignedDriverRef?: string
    status: string
    deliveryJourneyLog?: any[]
    deliveryLat?: number
    deliveryLng?: number
    siteRef?: string
  } | null>(
    `*[_type == "order" && _id == $orderId][0]{
      _id,
      "assignedDriverRef": assignedDriver._ref,
      status,
      deliveryJourneyLog,
      deliveryLat,
      deliveryLng,
      "siteRef": site._ref
    }`,
    { orderId }
  )
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.assignedDriverRef !== driver._id) return NextResponse.json({ error: 'Order is not assigned to you' }, { status: 403 })
  
  const newLogEntry = {
    _key: crypto.randomUUID().replace(/-/g, ''),
    at: new Date().toISOString(),
    lat: driver.lastKnownLat ?? 0,
    lng: driver.lastKnownLng ?? 0,
    label: 'driver_picked_up',
    source: 'driver'
  }
  
  const currentLogs = order.deliveryJourneyLog ?? []

  // Calculate ETA from business (driver's current location at pickup) to customer
  let estimatedDeliveryMinutes: number | undefined
  const fromLat = driver.lastKnownLat
  const fromLng = driver.lastKnownLng
  const toLat = order.deliveryLat
  const toLng = order.deliveryLng

  if (fromLat && fromLng && toLat && toLng) {
    const osrmMinutes = await fetchOsrmDurationMinutes(fromLat, fromLng, toLat, toLng)
    if (osrmMinutes != null) {
      estimatedDeliveryMinutes = osrmMinutes + EXTRA_BUFFER_MINUTES
    } else {
      // Fallback: Haversine straight-line distance at ~30 km/h city speed
      const R = 6371
      const dLat = ((toLat - fromLat) * Math.PI) / 180
      const dLng = ((toLng - fromLng) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((fromLat * Math.PI) / 180) *
          Math.cos((toLat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2
      const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      estimatedDeliveryMinutes = Math.ceil((km / 30) * 60) + EXTRA_BUFFER_MINUTES
    }
  }

  const patchFields: Record<string, unknown> = {
    status: 'out-for-delivery',
    driverPickedUpAt: new Date().toISOString(),
    deliveryJourneyLog: [...currentLogs, newLogEntry],
  }
  if (estimatedDeliveryMinutes != null) {
    patchFields.estimatedDeliveryMinutes = estimatedDeliveryMinutes
  }

  await writeClient.patch(orderId).set(patchFields).commit()

  sendCustomerOrderStatusPush({
    orderId,
    newStatus: 'out-for-delivery',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
    estimatedDeliveryMinutes,
  }).catch((e) => console.warn('[customer-order-push]', e))

  sendTenantOrderUpdatePush({
    orderId,
    status: 'out-for-delivery',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  }).catch((e) => console.warn('[tenant-order-push]', e))

  return NextResponse.json({ success: true })
}
