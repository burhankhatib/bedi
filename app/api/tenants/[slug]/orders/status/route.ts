import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { NotificationService } from '@/lib/notifications/NotificationService'

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
  const { slug } = await params
  if (!token) return NextResponse.json({ error: 'Server config' }, { status: 500 })

  const body = await req.json()
  const { orderId, status, completedAt, acknowledgeTableRequest, notifyAt, newScheduledFor } = body
  if (!orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 })
  }

  const check = await checkOrderOwnership(slug, orderId)
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status })

  const orderBefore = await writeClient.fetch<{ assignedDriver?: any, scheduledFor?: string } | null>(
    `*[_type == "order" && _id == $orderId][0]{ assignedDriver, scheduledFor }`,
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
    patch.unset(['businessWhatsappNotifiedAt'])
    
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
    }
  }
  if (status === 'preparing' || status === 'waiting_for_delivery') {
    updateData.preparedAt = new Date().toISOString()
    if (orderBefore?.assignedDriver) {
      updateData.deliveryRequestedAt = new Date().toISOString()
      patch.unset(['assignedDriver'])
    }
  }
  if (status === 'out-for-delivery') {
    updateData.driverPickedUpAt = new Date().toISOString()
  }
  if (status === 'cancelled' || status === 'refunded') {
    updateData.cancelledAt = new Date().toISOString()
  }

  await patch.set(updateData).commit()

  await NotificationService.onOrderStatusUpdated({
    orderId,
    status,
    isScheduleUpdate: !!newScheduledFor && newScheduledFor !== orderBefore?.scheduledFor
  })

  return NextResponse.json({ success: true, orderId, status })
}
