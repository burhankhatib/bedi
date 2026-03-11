import { NextRequest } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Serves the per-business management PWA service worker under /t/[slug]/manage/sw.js.
 * Injects business-manage config into the universal pwa-sw.js template.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const template = readFileSync(join(process.cwd(), 'public', 'pwa-sw.js'), 'utf-8')
  const allowedScope = `/t/${slug}/`
  const config = [
    `var PWA_ROLE = 'business-manage';`,
    `var PWA_DEFAULT_URL = '/t/${slug}/orders';`,
    `var PWA_DEFAULT_ICON = '/adminslogo.webp';`,
    `var PWA_TAG = 'bedi-tenant-order-update';`,
    `var PWA_DEFAULT_TITLE = 'New order';`,
    `var PWA_DEFAULT_DIR = 'ltr';`,
    `var PWA_SKIP_WAITING = false;`,
  ].join('\n')
  return new Response(config + '\n\n' + template, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Service-Worker-Allowed': allowedScope,
    },
  })
}

