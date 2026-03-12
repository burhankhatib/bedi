import { NextRequest, NextResponse } from 'next/server'

type Role = 'customer' | 'driver' | 'dashboard'

function getOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  return `${protocol}://${host}`
}

function buildManifest(role: Role, origin: string) {
  switch (role) {
    case 'customer':
      return {
        id: `${origin}/`,
        name: 'Bedi Delivery',
        short_name: 'Bedi Delivery',
        description: 'Order from your favorite restaurants and stores. Get order updates and offers.',
        start_url: `${origin}/`,
        scope: `${origin}/`,
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        background_color: '#0f172a',
        theme_color: '#0f172a',
        orientation: 'portrait-primary',
        icons: [
          { src: `${origin}/customersLogo.webp`, sizes: '192x192', type: 'image/webp', purpose: 'any' },
          { src: `${origin}/customersLogo.webp`, sizes: '512x512', type: 'image/webp', purpose: 'any' },
          { src: `${origin}/customersLogo.webp`, sizes: '192x192', type: 'image/webp', purpose: 'maskable' },
          { src: `${origin}/customersLogo.webp`, sizes: '512x512', type: 'image/webp', purpose: 'maskable' },
        ],
        categories: ['food', 'shopping', 'lifestyle'],
      }

    case 'driver':
      return {
        id: `${origin}/driver/`,
        name: 'Bedi Driver',
        short_name: 'Bedi Driver',
        description: 'Receive and manage delivery orders.',
        start_url: `${origin}/driver`,
        scope: `${origin}/driver/`,
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#1e293b',
        orientation: 'portrait-primary',
        icons: [
          { src: `${origin}/driversLogo.webp`, sizes: '192x192', type: 'image/webp', purpose: 'any' },
          { src: `${origin}/driversLogo.webp`, sizes: '512x512', type: 'image/webp', purpose: 'any' },
          { src: `${origin}/driversLogo.webp`, sizes: '192x192', type: 'image/webp', purpose: 'maskable' },
          { src: `${origin}/driversLogo.webp`, sizes: '512x512', type: 'image/webp', purpose: 'maskable' },
        ],
        categories: ['productivity', 'navigation'],
      }

    case 'dashboard':
      return {
        id: `${origin}/dashboard/`,
        name: 'Bedi Business',
        short_name: 'Bedi Business',
        description: 'Manage your businesses, menus, and orders.',
        start_url: `${origin}/dashboard`,
        scope: `${origin}/dashboard/`,
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#f59e0b',
        orientation: 'portrait-primary',
        icons: [
          { src: `${origin}/adminslogo.webp`, sizes: '192x192', type: 'image/webp', purpose: 'any' },
          { src: `${origin}/adminslogo.webp`, sizes: '512x512', type: 'image/webp', purpose: 'any' },
          { src: `${origin}/adminslogo.webp`, sizes: '192x192', type: 'image/webp', purpose: 'maskable' },
          { src: `${origin}/adminslogo.webp`, sizes: '512x512', type: 'image/webp', purpose: 'maskable' },
        ],
        categories: ['business', 'productivity'],
      }
  }
}

export function GET(
  req: NextRequest,
  { params }: { params: Promise<{ role: string }> }
) {
  return params.then(({ role }) => {
    const validRoles: Role[] = ['customer', 'driver', 'dashboard']
    if (!validRoles.includes(role as Role)) {
      return NextResponse.json({ error: 'Unknown role' }, { status: 404 })
    }

    const origin = getOrigin(req)
    const manifest = buildManifest(role as Role, origin)

    return NextResponse.json(manifest, {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    })
  })
}
