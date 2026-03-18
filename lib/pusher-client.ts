import PusherClient from 'pusher-js'

let pusherClientInstance: PusherClient | null = null

/**
 * Returns the singleton Pusher browser client.
 * Returns null during SSR (no window).
 */
export const getPusherClient = (): PusherClient | null => {
  if (typeof window === 'undefined') return null
  if (!pusherClientInstance) {
    pusherClientInstance = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
    })
  }
  return pusherClientInstance
}

/**
 * Named export for direct import: `import { pusherClient } from '@/lib/pusher-client'`
 * Note: may be null on the server — always guard with typeof window !== 'undefined'.
 */
export const pusherClient = typeof window !== 'undefined' ? getPusherClient() : null
