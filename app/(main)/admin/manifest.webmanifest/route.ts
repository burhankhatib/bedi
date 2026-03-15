import { NextRequest, NextResponse } from 'next/server'

/** Admin PWA manifest — install from /admin for quick access to broadcast and inbox. */
function getManifest(origin: string) {
  return {
    id: `${origin}/admin/`,
    name: 'Bedi Admin',
    short_name: 'Bedi Admin',
    description: 'Platform admin: WhatsApp broadcast, inbox, and management.',
    start_url: `${origin}/admin/broadcast`,
    scope: `${origin}/admin/`,
    display: 'standalone' as const,
    display_override: ['standalone', 'minimal-ui'] as const,
    background_color: '#020617',
    theme_color: '#f59e0b',
    orientation: 'portrait-primary' as const,
    icons: [
      { src: `${origin}/adminslogo.webp`, sizes: '192x192', type: 'image/webp', purpose: 'any' },
      { src: `${origin}/adminslogo.webp`, sizes: '512x512', type: 'image/webp', purpose: 'any maskable' },
    ],
    categories: ['business', 'utilities'],
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
