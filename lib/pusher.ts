import Pusher from 'pusher'

type PusherTriggerData = Record<string, unknown>

let pusherInstance: Pusher | null | undefined
let missingConfigWarned = false
let lastInitErrorMessage: string | null = null

function getMissingPusherEnvKeys(): string[] {
  const missing: string[] = []
  if (!process.env.PUSHER_APP_ID) missing.push('PUSHER_APP_ID')
  if (!process.env.NEXT_PUBLIC_PUSHER_KEY) missing.push('NEXT_PUBLIC_PUSHER_KEY')
  if (!process.env.PUSHER_SECRET) missing.push('PUSHER_SECRET')
  if (!process.env.NEXT_PUBLIC_PUSHER_CLUSTER) missing.push('NEXT_PUBLIC_PUSHER_CLUSTER')
  return missing
}

function isPusherConfigured(): boolean {
  return getMissingPusherEnvKeys().length === 0
}

export function getPusherServerHealth() {
  const missingEnvKeys = getMissingPusherEnvKeys()
  return {
    configured: missingEnvKeys.length === 0,
    missingEnvKeys,
    initialized: pusherInstance !== undefined,
    available: pusherInstance !== undefined && pusherInstance !== null,
    lastInitErrorMessage,
  }
}

function getPusherInstance(): Pusher | null {
  if (pusherInstance !== undefined) return pusherInstance

  if (!isPusherConfigured()) {
    if (!missingConfigWarned) {
      missingConfigWarned = true
      console.warn('[pusher] Server not configured; realtime events are disabled')
    }
    pusherInstance = null
    return pusherInstance
  }

  try {
    pusherInstance = new Pusher({
      appId: process.env.PUSHER_APP_ID as string,
      key: process.env.NEXT_PUBLIC_PUSHER_KEY as string,
      secret: process.env.PUSHER_SECRET as string,
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER as string,
      useTLS: true,
    })
    lastInitErrorMessage = null
  } catch (err) {
    lastInitErrorMessage = err instanceof Error ? err.message : String(err)
    console.warn('[pusher] Failed to initialize server client', err)
    pusherInstance = null
  }

  return pusherInstance
}

export const pusherServer = {
  async trigger(channel: string, event: string, data: PusherTriggerData): Promise<boolean> {
    const pusher = getPusherInstance()
    if (!pusher) return false
    try {
      await pusher.trigger(channel, event, data)
      return true
    } catch (err) {
      console.warn(`[pusher] trigger failed — channel=${channel} event=${event}`, err)
      return false
    }
  },
  authorizeChannel(socketId: string, channelName: string): ReturnType<Pusher['authorizeChannel']> {
    const pusher = getPusherInstance()
    if (!pusher) {
      throw new Error('Pusher server is not configured')
    }
    return pusher.authorizeChannel(socketId, channelName)
  },
}

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
  data: PusherTriggerData
): Promise<void> {
  await pusherServer.trigger(channel, event, data)
}
