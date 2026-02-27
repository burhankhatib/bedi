import { NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'

export async function PATCH(request: Request) {
  try {
    const { orderId, items, subtotal, totalAmount } = await request.json()

    console.log('Order items update request:', { orderId, itemsCount: items?.length, subtotal, totalAmount })

    if (!orderId || !items) {
      console.error('Missing required fields:', { orderId, items })
      return NextResponse.json(
        { error: 'Missing required fields: orderId and items' },
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

    console.log('Order found, updating items...')

    // Build the update data
    const updateData: Record<string, any> = {
      items,
      subtotal: subtotal || 0,
      totalAmount: totalAmount || 0,
    }

    // Update the order
    const result = await writeClient
      .patch(orderId)
      .set(updateData)
      .commit()

    console.log('Order items updated successfully:', {
      orderId: result._id,
      itemsCount: items.length,
      totalAmount: result.totalAmount
    })

    return NextResponse.json({ 
      success: true,
      orderId,
      result
    })
  } catch (error) {
    console.error('Error updating order items:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to update order items', details: errorMessage },
      { status: 500 }
    )
  }
}
