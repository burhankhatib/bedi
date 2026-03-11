import { NextRequest, NextResponse } from 'next/server'

/**
 * Customer PWA manifest served directly at /manifest.json (no rewrite).
 * Required: id, application/manifest+json, so Chrome treats the app as installable.
 */
export function GET(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const origin = `${protocol}://${host}`

  const manifest = {
    id: `${origin}/`,
    name: 'Bedi',
    short_name: 'Bedi',
    description: 'Order from your favorite restaurants and stores. Get order updates and offers.',
    start_url: `${origin}/`,
    scope: `${origin}/`,
    display: 'standalone' as const,
    display_override: ['standalone', 'minimal-ui'] as const,
    background_color: '#0f172a',
    theme_color: '#0f172a',
    orientation: 'portrait-primary' as const,
    icons: [
      { src: `${origin}/customersLogo.webp`, sizes: '192x192', type: 'image/webp', purpose: 'any' as const },
      { src: `${origin}/customersLogo.webp`, sizes: '512x512', type: 'image/webp', purpose: 'any' as const },
      { src: `${origin}/customersLogo.webp`, sizes: '192x192', type: 'image/webp', purpose: 'maskable' as const },
      { src: `${origin}/customersLogo.webp`, sizes: '512x512', type: 'image/webp', purpose: 'maskable' as const },
    ],
    categories: ['food', 'shopping', 'lifestyle'],
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  })
}
