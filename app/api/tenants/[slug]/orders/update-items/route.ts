import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { sendPushNotification, isPushConfigured } from '@/lib/push'
import { sendFCMToToken, isFCMConfigured } from '@/lib/fcm'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

async function checkOrderOwnership(slug: string, orderId: string) {
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return { ok: false as const, status: auth.status }
  const doc = await client.fetch<{ _id: string; site?: { _ref: string } } | null>(
    `*[_type == "order" && _id == $orderId][0]{ _id, site }`,
    { orderId }
  )
  if (!doc || doc.site?._ref !== auth.tenantId) return { ok: false as const, status: 403 }
  return { ok: true as const }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json()
  const { orderId, items, subtotal, totalAmount } = body
  if (!orderId || !items) {
    return NextResponse.json({ error: 'orderId and items required' }, { status: 400 })
  }

  const check = await checkOrderOwnership(slug, orderId)
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status })

  const itemsUpdatedAt = new Date().toISOString()
  const updateData: Record<string, unknown> = {
    items,
    subtotal: subtotal ?? 0,
    totalAmount: totalAmount ?? 0,
    itemsUpdatedAt,
  }

  const result = await writeClient.patch(orderId).set(updateData).commit()

  const pushReady = isFCMConfigured() || isPushConfigured()
  if (pushReady) {
    try {
      const order = await writeClient.fetch<{
        orderNumber?: string
        assignedDriverRef?: string
      } | null>(
        `*[_type == "order" && _id == $orderId][0]{ orderNumber, "assignedDriverRef": assignedDriver._ref }`,
        { orderId }
      )
      const driverRef = order?.assignedDriverRef
      if (driverRef) {
        const driver = await writeClient.fetch<{
          fcmToken?: string
          pushSubscription?: { endpoint?: string; p256dh?: string; auth?: string }
        } | null>(
          `*[_type == "driver" && _id == $driverId][0]{ fcmToken, "pushSubscription": pushSubscription }`,
          { driverId: driverRef }
        )
        const num = (order?.orderNumber ?? orderId.slice(-6)) as string
        const payload = {
          title: 'Order updated',
          body: `Order #${num} was updated. Please confirm the new amount.`,
          url: '/driver/orders',
        }
        if (driver?.fcmToken && isFCMConfigured()) {
          await sendFCMToToken(driver.fcmToken, payload)
        } else {
          const sub = driver?.pushSubscription
          if (sub?.endpoint && sub?.p256dh && sub?.auth && isPushConfigured()) {
            await sendPushNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            )
          }
        }
      }
    } catch (e) {
      console.error('[update-items] Driver push failed:', e)
    }
  }

  return NextResponse.json({ success: true, orderId, result })
}
