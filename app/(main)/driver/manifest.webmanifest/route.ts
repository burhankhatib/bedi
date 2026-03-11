import { NextRequest, NextResponse } from 'next/server'

/** Driver PWA manifest — unique id so it installs separately from tenant menu/dashboard. */
function getManifest(origin: string) {
  return {
    id: `${origin}/driver/`,
    name: 'Bedi Driver',
    short_name: 'Bedi Driver',
    description: 'Receive and manage delivery orders.',
    start_url: `${origin}/driver`,
    scope: `${origin}/driver/`,
    display: 'standalone' as const,
    display_override: ['standalone', 'minimal-ui'] as const,
    background_color: '#020617',
    theme_color: '#020617',
    orientation: 'portrait-primary' as const,
    icons: [
      { src: `${origin}/driversLogo.webp`, sizes: '192x192', type: 'image/webp', purpose: 'any' },
      { src: `${origin}/driversLogo.webp`, sizes: '512x512', type: 'image/webp', purpose: 'any maskable' },
    ],
    categories: ['food', 'delivery'],
  }
}

export function GET(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const origin = `${protocol}://${host}`
  return NextResponse.json(getManifest(origin), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  })
}
