import { NextRequest } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Serves the tenant Orders PWA service worker under /t/[slug]/orders/sw.js
 * so registration can use scope /t/[slug]/orders/ and each business Orders
 * page gets a separate install with push support.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const body = readFileSync(join(process.cwd(), 'public', 'tenant-orders-sw.js'), 'utf-8')
  const scope = `/t/${slug}/orders/`
  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Service-Worker-Allowed': scope,
    },
  })
}
