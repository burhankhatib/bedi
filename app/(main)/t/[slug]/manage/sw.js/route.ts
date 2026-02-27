import { NextRequest } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Serves the tenant PWA service worker under /t/[slug]/manage/sw.js so each business
 * dashboard gets a separate install with push support. Uses tenant-sw.js (push + fetch).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const body = readFileSync(join(process.cwd(), 'public', 'tenant-sw.js'), 'utf-8')
  const scope = `/t/${slug}/manage/`
  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Service-Worker-Allowed': scope,
    },
  })
}
