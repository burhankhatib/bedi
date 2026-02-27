import { NextRequest } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Serves the driver PWA service worker under /driver/sw.js so registration
 * can use scope /driver/ and the driver app installs separately from tenant PWAs.
 */
export async function GET(_req: NextRequest) {
  const body = readFileSync(join(process.cwd(), 'public', 'driver-sw.js'), 'utf-8')
  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Service-Worker-Allowed': '/driver/',
    },
  })
}
