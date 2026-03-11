import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

/**
 * Serves the dashboard PWA service worker under /dashboard/sw.js.
 * Injects tenant-dashboard config into the universal pwa-sw.js template.
 */
export async function GET() {
  try {
    const template = await fs.readFile(path.join(process.cwd(), 'public', 'pwa-sw.js'), 'utf8')
    const config = [
      `var PWA_ROLE = 'tenant-dashboard';`,
      `var PWA_DEFAULT_URL = '/dashboard';`,
      `var PWA_DEFAULT_ICON = '/adminslogo.webp';`,
      `var PWA_TAG = 'bedi-business-new-order';`,
      `var PWA_DEFAULT_TITLE = 'New order';`,
      `var PWA_DEFAULT_DIR = 'ltr';`,
      `var PWA_SKIP_WAITING = false;`,
    ].join('\n')
    return new NextResponse(config + '\n\n' + template, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Service-Worker-Allowed': '/dashboard',
      },
    })
  } catch {
    return new NextResponse('// Dashboard service worker is unavailable', {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Service-Worker-Allowed': '/dashboard',
      },
    })
  }
}
