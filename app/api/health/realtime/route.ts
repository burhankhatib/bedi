import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isFCMConfigured } from '@/lib/fcm'
import { pusherServer, getPusherServerHealth } from '@/lib/pusher'
import { isPushConfigured } from '@/lib/push'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pusherBefore = getPusherServerHealth()
  let triggerOk = false

  if (pusherBefore.configured) {
    triggerOk = await pusherServer.trigger('healthcheck-zonify', 'diagnostic-ping', {
      at: new Date().toISOString(),
      source: 'api/health/realtime',
    })
  }

  const pusherAfter = getPusherServerHealth()
  const ok = pusherAfter.configured && pusherAfter.available && triggerOk

  return NextResponse.json(
    {
      ok,
      checkedAt: new Date().toISOString(),
      pusher: {
        configured: pusherAfter.configured,
        initialized: pusherAfter.initialized,
        available: pusherAfter.available,
        triggerOk,
        missingEnvKeys: pusherAfter.missingEnvKeys,
        lastInitErrorMessage: pusherAfter.lastInitErrorMessage,
      },
      notifications: {
        fcmConfigured: isFCMConfigured(),
        webPushConfigured: isPushConfigured(),
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
