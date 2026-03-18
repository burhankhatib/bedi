import Pusher from 'pusher'

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
})

/**
 * Reusable server-side Pusher trigger.
 * Fire-and-forget — errors are logged but never thrown so they don't break
 * the calling request.
 *
 * @param channel  e.g. `order-abc123`, `tenant-xyz`, `driver-location-abc123`
 * @param event    e.g. `order-update`, `location-update`, `new-order`
 * @param data     Must be JSON-serialisable
 */
export async function triggerPusherEvent(
  channel: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    await pusherServer.trigger(channel, event, data)
  } catch (err) {
    console.warn(`[pusher] trigger failed — channel=${channel} event=${event}`, err)
  }
}
