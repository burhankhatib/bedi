import { NextRequest } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Serves the per-business PWA service worker under /t/[slug]/sw.js so registration
 * can use scope /t/[slug]/ and one business app can cover both /orders and /manage.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const body = readFileSync(join(process.cwd(), 'public', 'tenant-sw.js'), 'utf-8')
  const scope = `/t/${slug}/`
  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Service-Worker-Allowed': scope,
    },
  })
}
