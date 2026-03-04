import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { sendCustomerOrderStatusPush } from '@/lib/customer-order-push'
import { sendTenantOrderUpdatePush } from '@/lib/tenant-order-push'

export async function PATCH(request: Request) {
  try {
    const { orderId, status, completedAt } = await request.json()

    console.log('Status update request:', { orderId, status, completedAt })

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

    // Build the update data
    const updateData: Record<string, unknown> = { status }
    
    if (completedAt) {
      updateData.completedAt = completedAt
    }
    if (status === 'preparing' || status === 'waiting_for_delivery') {
      updateData.preparedAt = new Date().toISOString()
    }
    if (status === 'out-for-delivery') {
      updateData.driverPickedUpAt = new Date().toISOString()
    }
    if (status === 'cancelled' || status === 'refunded') {
      updateData.cancelledAt = new Date().toISOString()
    }

    console.log('Updating order with data:', updateData)

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

    // Update the order
    const result = await writeClient
      .patch(orderId)
      .set(updateData)
      .commit()

    sendCustomerOrderStatusPush({
      orderId,
      newStatus: status,
      baseUrl: process.env.NEXT_PUBLIC_APP_URL,
    }).catch((e) => console.warn('[customer-order-push]', e))

    sendTenantOrderUpdatePush({
      orderId,
      status: status as import('@/lib/tenant-order-push').TenantOrderPushStatus,
      baseUrl: process.env.NEXT_PUBLIC_APP_URL,
    }).catch((e) => console.warn('[tenant-order-push]', e))

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
