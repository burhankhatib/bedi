import { NextRequest, NextResponse } from 'next/server'

/** Unified Business PWA manifest — one app for all businesses. Install from dashboard; push for new orders from any business. */
function getManifest(origin: string) {
  return {
    id: `${origin}/dashboard`,
    name: 'Bedi Business',
    short_name: 'Bedi Business',
    description: 'Manage your businesses, menus, and orders. Get new order notifications for all your businesses.',
    start_url: `${origin}/dashboard`,
    scope: `${origin}/dashboard/`,
    display: 'standalone' as const,
    display_override: ['standalone', 'minimal-ui'] as const,
    background_color: '#020617',
    theme_color: '#f59e0b',
    orientation: 'portrait-primary' as const,
    icons: [
      { src: `${origin}/adminslogo.webp`, sizes: '192x192', type: 'image/webp', purpose: 'any' },
      { src: `${origin}/adminslogo.webp`, sizes: '512x512', type: 'image/webp', purpose: 'any maskable' },
    ],
    categories: ['business', 'food', 'delivery'],
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
