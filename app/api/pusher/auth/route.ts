import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { pusherServer } from '@/lib/pusher'
import { client } from '@/sanity/lib/client'

/**
 * POST /api/pusher/auth
 *
 * Authenticates clients before they can subscribe to private Pusher channels.
 * Pusher JS sends socket_id + channel_name as form-encoded POST data, plus any
 * extra auth.params we configured in pusher-client.ts.
 *
 * Two channel families are handled:
 *
 *   private-driver-global
 *     → Requires a valid Clerk session belonging to a verified driver.
 *       Used by DriverLocationTracker to receive GPS refresh commands.
 *
 *   private-driver-location-{orderId}
 *     → Requires a valid tracking_token matching the order's trackingToken field.
 *       Used by the customer tracking page — customers are NOT Clerk-authenticated.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const socketId = formData.get('socket_id') as string | null
  const channelName = formData.get('channel_name') as string | null

  if (!socketId || !channelName) {
    return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 })
  }

  // ── private-driver-global ──────────────────────────────────────────────────
  if (channelName === 'private-driver-global') {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the Clerk user has a verified, non-blocked driver profile
    const driverId = await client
      .withConfig({ useCdn: false })
      .fetch<string | null>(
        `*[_type == "driver" && clerkUserId == $userId && isVerifiedByAdmin == true && (!defined(blockedBySuperAdmin) || blockedBySuperAdmin == false)][0]._id`,
        { userId }
      )
    if (!driverId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
      const authResponse = pusherServer.authorizeChannel(socketId, channelName)
      return NextResponse.json(authResponse)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pusher auth failed'
      return NextResponse.json({ error: message }, { status: 503 })
    }
  }

  // ── private-driver-location-{orderId} ────────────────────────────────────
  if (channelName.startsWith('private-driver-location-')) {
    const channelOrderId = channelName.slice('private-driver-location-'.length)
    const trackingToken = formData.get('tracking_token') as string | null
    const paramOrderId = formData.get('order_id') as string | null

    // Reject if caller doesn't supply a token or if the orderId in the params
    // doesn't match the one in the channel name (sanity guard against spoofing).
    if (!trackingToken || !paramOrderId || paramOrderId !== channelOrderId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify the tracking token actually belongs to this order
    const orderId = await client
      .withConfig({ useCdn: false })
      .fetch<string | null>(
        `*[_type == "order" && _id == $orderId && trackingToken == $trackingToken][0]._id`,
        { orderId: channelOrderId, trackingToken }
      )
    if (!orderId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
      const authResponse = pusherServer.authorizeChannel(socketId, channelName)
      return NextResponse.json(authResponse)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pusher auth failed'
      return NextResponse.json({ error: message }, { status: 503 })
    }
  }

  return NextResponse.json({ error: 'Unknown channel' }, { status: 400 })
}
