import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { NotificationService } from '@/lib/notifications/NotificationService'
import {
  cancelOrderJobs,
  scheduleDeliveryLifecycleJobs,
  scheduleOrderUnacceptedWhatsapp,
  scheduleScheduledOrderReminder,
} from '@/lib/delivery-job-scheduler'
import { recordOrderUnacceptedWhatsappJobResult } from '@/lib/notification-diagnostics'

export async function PATCH(request: Request) {
  try {
    const { orderId, status, completedAt, notifyAt, newScheduledFor } = await request.json()

    console.log('Status update request:', { orderId, status, completedAt, notifyAt, newScheduledFor })

    if (!orderId || !status) {
      console.error('Missing required fields:', { orderId, status })
      return NextResponse.json(
        { error: 'Missing required fields: orderId and status' },
        { status: 400 }
      )
    }

    // Check if token is available
    if (!token) {
      console.error('Missing API token')
      return NextResponse.json(
        { error: 'Server configuration error: Missing API token' },
        { status: 500 }
      )
    }

    // Create a client with write permissions
    const writeClient = client.withConfig({ 
      token,
      useCdn: false 
    })

    // First verify the order exists
    const existingOrder = await writeClient.fetch(`*[_id == $orderId][0]`, { orderId })
    if (!existingOrder) {
      console.error('Order not found:', orderId)
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    console.log('Order found, current status:', existingOrder.status)

    const patch = writeClient.patch(orderId)

    // Build the update data
    const updateData: Record<string, unknown> = { status }
    
    if (completedAt) {
      updateData.completedAt = completedAt
    }
    if (newScheduledFor && newScheduledFor !== existingOrder.scheduledFor) {
      updateData.scheduledFor = newScheduledFor
      updateData.reminderSent = false
      patch.unset([
        'businessWhatsappNotifiedAt',
        'businessWhatsappUnacceptedReminderAt',
        'businessWhatsappInstantNotifiedAt',
      ])
      
      // Handle edit history
      if (existingOrder.scheduledFor) {
        const historyEntry = {
          _key: `history-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          previousScheduledFor: existingOrder.scheduledFor,
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
      if (existingOrder.assignedDriver) {
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
    }
    if (status === 'new') {
      const jobRes = await scheduleOrderUnacceptedWhatsapp(orderId, Date.now())
      await recordOrderUnacceptedWhatsappJobResult(
        writeClient,
        orderId,
        'PATCH /api/orders/status (status=new)',
        jobRes
      )
    }

    console.log('Updating order with data:', updateData)

    // Update the order
    const result = await patch.set(updateData).commit()

    // Realtime/push notification failures should never fail status updates.
    await NotificationService.onOrderStatusUpdated({
      orderId,
      status,
      isScheduleUpdate: !!newScheduledFor && newScheduledFor !== existingOrder.scheduledFor
    }).catch((notifyError) => {
      console.warn('Order status updated, but notification dispatch failed:', notifyError)
    })

    console.log('Order updated successfully:', {
      orderId: result._id,
      oldStatus: existingOrder.status,
      newStatus: result.status
    })

    return NextResponse.json({ 
      success: true,
      orderId,
      status,
      result
    })
  } catch (error) {
    console.error('Error updating order status:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to update order status', details: errorMessage },
      { status: 500 }
    )
  }
}
