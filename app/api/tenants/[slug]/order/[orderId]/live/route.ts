import { NextRequest } from 'next/server'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { getTenantIdBySlug } from '@/lib/tenant'
import { phonesMatchForOrderLookup } from '@/lib/driver-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const writeClient = client.withConfig({ token: token || undefined, useCdn: false })

/** GET: SSE stream for customer order tracking. Query param phone required; must match order customerPhone. Emits when this order document changes. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  const { slug, orderId } = await params
  const phoneParam = req.nextUrl.searchParams.get('phone')
  if (!phoneParam?.trim()) {
    return new Response('Phone required', { status: 400 })
  }

  const tenantId = await getTenantIdBySlug(slug)
  if (!tenantId) {
    return new Response('Not found', { status: 404 })
  }

  const order = await client.fetch<{ site?: { _ref?: string }; customerPhone?: string } | null>(
    `*[_type == "order" && _id == $orderId][0]{ "site": site, customerPhone }`,
    { orderId }
  )
  if (!order || order.site?._ref !== tenantId) {
    return new Response('Order not found', { status: 404 })
  }
  if (!phonesMatchForOrderLookup(phoneParam, order.customerPhone ?? '')) {
    return new Response('Order not found', { status: 404 })
  }

  if (!token) {
    return new Response('Server config', { status: 500 })
  }

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
