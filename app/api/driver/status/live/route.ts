import { auth } from '@clerk/nextjs/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** GET: SSE stream. Emits when the current driver's document (isOnline, onlineSince) changes. */
export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })
  if (!token) return new Response('Server config', { status: 500 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        try {
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({ t: 'update' }) + '\n\n'))
        } catch {
          // client closed
        }
      }
      let sub: { unsubscribe: () => void } | null = null
      try {
        sub = writeClient
          .listen('*[_type == "driver" && clerkUserId == $userId][0]{ _id, isOnline, onlineSince }', { userId })
          .subscribe(send)
      } catch {
        send()
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
