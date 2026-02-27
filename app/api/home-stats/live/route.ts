import { NextRequest } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getHomePageStats } from '@/lib/home-stats'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** GET: SSE stream. Sends current homepage stats; re-sends when orders, tenants, or drivers change. */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: { stats?: Awaited<ReturnType<typeof getHomePageStats>> }) => {
        try {
          controller.enqueue(encoder.encode('data: ' + JSON.stringify(payload) + '\n\n'))
        } catch {
          // client closed
        }
      }

      try {
        const initial = await getHomePageStats()
        send({ stats: initial })
      } catch {
        send({})
      }

      let sub: { unsubscribe: () => void } | null = null
      if (token) {
        try {
          sub = writeClient
            .listen('*[_type in ["order","tenant","driver"]]{ _id }', {})
            .subscribe(async () => {
              try {
                const stats = await getHomePageStats()
                send({ stats })
              } catch {
                send({})
              }
            })
        } catch {
          // ignore
        }
      }

      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        } catch {
          sub?.unsubscribe()
          clearInterval(keepalive)
        }
      }, 30000)

      const cleanup = () => {
        sub?.unsubscribe()
        clearInterval(keepalive)
      }
      req.signal?.addEventListener('abort', cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Connection: 'keep-alive',
    },
  })
}
