import { NextRequest } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Serves the driver PWA service worker under /driver/sw.js.
 * Injects driver-specific config into the universal pwa-sw.js template.
 */
export async function GET(_req: NextRequest) {
  const template = readFileSync(join(process.cwd(), 'public', 'pwa-sw.js'), 'utf-8')
  const config = [
    `var PWA_ROLE = 'driver';`,
    `var PWA_DEFAULT_URL = '/driver/orders';`,
    `var PWA_DEFAULT_ICON = '/driversLogo.webp';`,
    `var PWA_TAG = 'bedi-driver-delivery';`,
    `var PWA_DEFAULT_TITLE = 'New delivery request';`,
    `var PWA_DEFAULT_DIR = 'ltr';`,
    `var PWA_SKIP_WAITING = false;`,
  ].join('\n')
  const body = config + '\n\n' + template
  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Service-Worker-Allowed': '/driver/',
    },
  })
}
