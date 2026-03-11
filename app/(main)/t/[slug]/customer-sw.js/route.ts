import { NextRequest } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Serves per-business CUSTOMER PWA service worker at /t/[slug]/customer-sw.js.
 * This enables independent customer app installs per business page.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const template = readFileSync(join(process.cwd(), 'public', 'pwa-sw.js'), 'utf-8')
  const config = [
    `var PWA_ROLE = 'customer-business';`,
    `var PWA_DEFAULT_URL = '/t/${slug}';`,
    `var PWA_DEFAULT_ICON = '/t/${slug}/icon/192';`,
    `var PWA_TAG = 'bedi-customer-${slug}';`,
    `var PWA_DEFAULT_TITLE = 'Bedi';`,
    `var PWA_DEFAULT_DIR = 'ltr';`,
    `var PWA_SKIP_WAITING = true;`,
  ].join('\n')

  return new Response(config + '\n\n' + template, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Service-Worker-Allowed': `/t/${slug}`,
    },
  })
}
