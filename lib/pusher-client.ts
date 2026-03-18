import PusherClient from 'pusher-js'

let pusherClientInstance: PusherClient | null = null

/**
 * Module-level store for auth params. paramsProvider reads from this on each
 * private channel auth request. Avoids mutating pusher-js internal config.
 */
const authParamsStore: Record<string, string> = {}

/**
 * Merge extra params into the Pusher auth request.
 * Call this BEFORE subscribing to a private channel so the auth endpoint
 * receives the right credentials (tracking token for customers,
 * or nothing extra for drivers who rely on the Clerk cookie).
 */
export function setPusherAuthParams(params: Record<string, string>): void {
  Object.assign(authParamsStore, params)
}

export const getPusherClient = (): PusherClient | null => {
  if (typeof window === 'undefined') return null
  if (!pusherClientInstance) {
    pusherClientInstance = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
      channelAuthorization: {
        endpoint: '/api/pusher/auth',
        transport: 'ajax',
        paramsProvider: () => ({ ...authParamsStore }),
      },
    })
  }
  return pusherClientInstance
}

export const pusherClient = typeof window !== 'undefined' ? getPusherClient() : null
