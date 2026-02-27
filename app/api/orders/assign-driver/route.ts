import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'

export async function PATCH(req: NextRequest) {
  if (req.method !== 'PATCH') {
    return new NextResponse(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405 })
  }

  try {
    const { orderId, driverId } = await req.json()

    if (!orderId || !driverId) {
      return new NextResponse(JSON.stringify({ message: 'Missing orderId or driverId' }), { status: 400 })
    }

    if (!token) {
      return new NextResponse(JSON.stringify({ message: 'Sanity API token is not configured.' }), { status: 500 })
    }

    const sanityClient = client.withConfig({ token, useCdn: false })

    await sanityClient
      .patch(orderId)
      .set({
        assignedDriver: {
          _type: 'reference',
          _ref: driverId,
        },
        status: 'out-for-delivery',
      })
      .commit()

    return new NextResponse(JSON.stringify({ message: 'Driver assigned successfully' }), { status: 200 })
  } catch (error) {
    console.error('Failed to assign driver:', error)
    return new NextResponse(JSON.stringify({ message: 'Failed to assign driver' }), { status: 500 })
  }
}
