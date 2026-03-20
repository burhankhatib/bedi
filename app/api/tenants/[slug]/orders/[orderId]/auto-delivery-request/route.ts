import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import {
  computeAutoDeliveryScheduledAtIso,
  isValidAutoDeliveryMinutes,
} from '@/lib/auto-delivery-request'
import { executeDeliveryRequestBroadcast } from '@/lib/execute-delivery-request-broadcast'

type OrderRow = {
  _id: string
  site?: { _ref: string }
  orderType?: string
  status?: string
  assignedDriver?: { _ref?: string } | null
  deliveryRequestedAt?: string | null
}

async function assertOrderAccess(slug: string, orderId: string) {
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return { ok: false as const, status: auth.status }
  const doc = await client.fetch<OrderRow | null>(
    `*[_type == "order" && _id == $orderId][0]{ _id, orderType, status, site, assignedDriver, deliveryRequestedAt }`,
    { orderId }
  )
  if (!doc || doc.site?._ref !== auth.tenantId) return { ok: false as const, status: 403 }
  return { ok: true as const, tenantId: auth.tenantId, doc }
}

/**
 * PATCH — Set or clear auto delivery request schedule; optionally persist tenant default.
 * Body: { minutes: number | null, savePreference?: boolean }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  const { slug, orderId } = await params
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  const minutes = body.minutes
  const savePreference = Boolean(body.savePreference)

  if (!isValidAutoDeliveryMinutes(minutes)) {
    return NextResponse.json({ error: 'Invalid minutes' }, { status: 400 })
  }

  const gate = await assertOrderAccess(slug, orderId)
  if (!gate.ok) return NextResponse.json({ error: 'Forbidden' }, { status: gate.status })
  const doc = gate.doc

  if (doc.orderType !== 'delivery') {
    return NextResponse.json({ error: 'Only delivery orders' }, { status: 400 })
  }
  if (doc.status === 'cancelled' || doc.status === 'refunded') {
    return NextResponse.json({ error: 'Order cancelled' }, { status: 400 })
  }
  if (doc.assignedDriver) {
    return NextResponse.json({ error: 'Driver already assigned' }, { status: 400 })
  }
  if (doc.deliveryRequestedAt) {
    return NextResponse.json({ error: 'Delivery already requested' }, { status: 400 })
  }

  const writeClient = client.withConfig({ token, useCdn: false })

  if (minutes === null) {
    await writeClient
      .patch(orderId)
      .unset(['autoDeliveryRequestMinutes', 'autoDeliveryRequestScheduledAt', 'autoDeliveryRequestTriggeredAt'])
      .commit()

    if (savePreference) {
      await writeClient
        .patch(gate.tenantId)
        .set({
          defaultAutoDeliveryRequestMinutes: null,
          saveAutoDeliveryRequestPreference: true,
        })
        .commit()
    }

    return NextResponse.json({
      success: true,
      autoDeliveryRequestMinutes: null,
      autoDeliveryRequestScheduledAt: null,
    })
  }

  if (minutes === 0) {
    await executeDeliveryRequestBroadcast(orderId)
    if (savePreference) {
      await writeClient
        .patch(gate.tenantId)
        .set({
          defaultAutoDeliveryRequestMinutes: 0,
          saveAutoDeliveryRequestPreference: true,
        })
        .commit()
    }
    return NextResponse.json({ success: true, firedImmediately: true })
  }

  const scheduledAt = computeAutoDeliveryScheduledAtIso(minutes)
  await writeClient
    .patch(orderId)
    .set({
      autoDeliveryRequestMinutes: minutes,
      autoDeliveryRequestScheduledAt: scheduledAt,
    })
    .unset(['autoDeliveryRequestTriggeredAt'])
    .commit()

  if (savePreference) {
    await writeClient
      .patch(gate.tenantId)
      .set({
        defaultAutoDeliveryRequestMinutes: minutes,
        saveAutoDeliveryRequestPreference: true,
      })
      .commit()
  }

  return NextResponse.json({
    success: true,
    autoDeliveryRequestMinutes: minutes,
    autoDeliveryRequestScheduledAt: scheduledAt,
  })
}
