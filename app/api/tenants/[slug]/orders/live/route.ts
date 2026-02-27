import { NextRequest } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { checkTenantAuth } from '@/lib/tenant-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** GET: SSE stream. Emits when any order for this tenant (site) changes. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) return new Response('Forbidden', { status: auth.status })
  if (!token) return new Response('Server config', { status: 500 })
  const siteId = auth.tenantId

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
        sub = writeClient.listen('*[_type == "order" && site._ref == $siteId]', { siteId }).subscribe(send)
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
