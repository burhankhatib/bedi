import { NextRequest } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token as sanityToken } from '@/sanity/lib/token'
import { getTenantIdBySlug } from '@/lib/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const writeClient = client.withConfig({ token: sanityToken || undefined, useCdn: false })

/** GET: SSE stream for customer order tracking by token. Emits when this order document changes. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  const { slug, token: trackingToken } = await params
  if (!trackingToken?.trim()) {
    return new Response('Invalid link', { status: 400 })
  }

  const tenantId = await getTenantIdBySlug(slug)
  if (!tenantId) {
    return new Response('Not found', { status: 404 })
  }

  const order = await client.fetch<{ _id: string; site?: { _ref?: string } } | null>(
    `*[_type == "order" && site._ref == $tenantId && trackingToken == $trackingToken][0]{ _id, "site": site }`,
    { tenantId, trackingToken }
  )
  if (!order || order.site?._ref !== tenantId) {
    return new Response('Order not found', { status: 404 })
  }

  if (!sanityToken) {
    return new Response('Server config', { status: 500 })
  }

  const orderId = order._id
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
        sub = writeClient.listen('*[_type == "order" && _id == $orderId]', { orderId }).subscribe(send)
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
