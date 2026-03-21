import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { NotificationService } from '@/lib/notifications/NotificationService'
import {
  cancelOrderJobs,
  scheduleDeliveryLifecycleJobs,
  scheduleOrderUnacceptedWhatsapp,
  scheduleScheduledOrderReminder,
} from '@/lib/delivery-job-scheduler'
import { recordOrderUnacceptedWhatsappJobResult } from '@/lib/notification-diagnostics'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** Order must belong to this tenant. No backfill — orphan orders (no site) cannot be claimed by any tenant. */
async function checkOrderOwnership(slug: string, orderId: string) {
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return { ok: false as const, status: auth.status }
  const doc = await client.fetch<{ _id: string; site?: { _ref: string } } | null>(
    `*[_type == "order" && _id == $orderId][0]{ _id, site }`,
    { orderId }
  )
  if (!doc) return { ok: false as const, status: 404 }
  if (doc.site?._ref !== auth.tenantId) return { ok: false as const, status: 403 }
  return { ok: true as const, auth, backfillSite: false }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const orderId = body.orderId as string | undefined
    const status = body.status as string | undefined
    const completedAt = body.completedAt
    const acknowledgeTableRequest = body.acknowledgeTableRequest === true
    const notifyAt = body.notifyAt as string | undefined
    const newScheduledFor = body.newScheduledFor as string | undefined

    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 })
    }

    const check = await checkOrderOwnership(slug, orderId)
    if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status })

    const orderBefore = await writeClient.fetch<{
      assignedDriver?: unknown
      scheduledFor?: string
      prioritizeWhatsapp?: boolean
      orderType?: string
      tableNumber?: string
    } | null>(
      `*[_type == "order" && _id == $orderId][0]{ assignedDriver, scheduledFor, "prioritizeWhatsapp": site->prioritizeWhatsapp, orderType, tableNumber }`,
      { orderId }
    )

    if (acknowledgeTableRequest === true) {
      const now = new Date().toISOString()
      await writeClient.patch(orderId).set({ customerRequestAcknowledgedAt: now }).commit()
      return NextResponse.json({ success: true, orderId, acknowledgedTableRequest: true })
    }

    if (!status) {
      return NextResponse.json({ error: 'status required' }, { status: 400 })
    }

    const patch = writeClient.patch(orderId)
    const updateData: Record<string, unknown> = { status }
    if (completedAt != null) updateData.completedAt = completedAt
    if (newScheduledFor && newScheduledFor !== orderBefore?.scheduledFor) {
      updateData.scheduledFor = newScheduledFor
      updateData.reminderSent = false
      patch.unset([
        'businessWhatsappNotifiedAt',
        'businessWhatsappUnacceptedReminderAt',
        'businessWhatsappInstantNotifiedAt',
      ])
      
      // Handle edit history
      if (orderBefore?.scheduledFor) {
        const historyEntry = {
          _key: `history-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          previousScheduledFor: orderBefore.scheduledFor,
          changedAt: new Date().toISOString()
        }
        patch.setIfMissing({ scheduleEditHistory: [] })
             .insert('after', 'scheduleEditHistory[-1]', [historyEntry])
      }
    }
    if (status === 'acknowledged') {
      updateData.acknowledgedAt = new Date().toISOString()
      if (notifyAt) {
        updateData.notifyAt = notifyAt
        updateData.reminderSent = false
        await scheduleScheduledOrderReminder(orderId, notifyAt)
      }
    }
    if (status === 'preparing' || status === 'waiting_for_delivery') {
      updateData.preparedAt = new Date().toISOString()
      if (orderBefore?.assignedDriver) {
        const reqAt = new Date().toISOString()
        updateData.deliveryRequestedAt = reqAt
        patch.unset(['assignedDriver'])
        await scheduleDeliveryLifecycleJobs(orderId, new Date(reqAt).getTime())
      }
    }
    if (status === 'out-for-delivery') {
      updateData.driverPickedUpAt = new Date().toISOString()
      await cancelOrderJobs(orderId)
    }
    if (status === 'cancelled' || status === 'refunded') {
      updateData.cancelledAt = new Date().toISOString()
      await cancelOrderJobs(orderId)
    }
    if (status === 'completed' || status === 'served') {
      await cancelOrderJobs(orderId)
      if (orderBefore?.orderType === 'dine-in' && orderBefore?.tableNumber && slug) {
        try {
          const { redis } = await import('@/lib/redis')
          if (redis) {
            await redis.del(`cart:${slug}:${orderBefore.tableNumber}`)
          }
        } catch (e) {
          console.error('[tenant/orders/status] Failed to clear Redis cart:', e)
        }
      }
    }
    if (status === 'new') {
      if (!orderBefore?.prioritizeWhatsapp) {
        const jobRes = await scheduleOrderUnacceptedWhatsapp(orderId, Date.now())
        await recordOrderUnacceptedWhatsappJobResult(
          writeClient,
          orderId,
          'PATCH /api/tenants/[slug]/orders/status (status=new)',
          jobRes
        )
      }
    }

    await patch.set(updateData).commit()

    // Realtime/push notification failures should not block tenant status updates.
    await NotificationService.onOrderStatusUpdated({
      orderId,
      status,
      isScheduleUpdate: !!newScheduledFor && newScheduledFor !== orderBefore?.scheduledFor
    }).catch((notifyError) => {
      console.warn('[tenant/orders/status] Notification dispatch failed:', notifyError)
    })

    return NextResponse.json({ success: true, orderId, status })
  } catch (error) {
    console.error('[tenant/orders/status] PATCH failed:', error)
    const details = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to update order status', details },
      { status: 500 }
    )
  }
}
