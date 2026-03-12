import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'

const FALLBACK_ICONS = (origin: string) => [
  { src: `${origin}/icons/icon-192x192.png`, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
  { src: `${origin}/icons/icon-512x512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
]

function getOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  return `${protocol}://${host}`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const searchParams = req.nextUrl.searchParams
  const type = searchParams.get('type') ?? 'page'

  const result = await client.fetch<{
    _id: string
    name: string
    restaurantInfo?: {
      name_en?: string
      name_ar?: string
      logo?: { _type: string; asset?: { _ref: string } }
    } | null
  } | null>(
    `*[_type == "tenant" && slug.current == $slug][0]{
      _id,
      name,
      "restaurantInfo": *[_type == "restaurantInfo" && site._ref == ^._id][0]{ name_en, name_ar, logo }
    }`,
    { slug }
  )

  if (!result) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const origin = getOrigin(req)
  const name = result.restaurantInfo?.name_en || result.name || 'Menu'
  const shortName = name.length > 12 ? name.slice(0, 11) + '…' : name
  const hasLogo = !!result.restaurantInfo?.logo

  const iconSizes: Array<{ size: number; purpose: string }> = [
    { size: 48, purpose: 'any' },
    { size: 72, purpose: 'any' },
    { size: 96, purpose: 'any' },
    { size: 128, purpose: 'any' },
    { size: 144, purpose: 'any' },
    { size: 152, purpose: 'any' },
    { size: 192, purpose: 'any maskable' },
    { size: 256, purpose: 'any' },
    { size: 384, purpose: 'any' },
    { size: 512, purpose: 'any maskable' },
  ]

  const icons = hasLogo
    ? iconSizes.map(({ size, purpose }) => ({
        src: `${origin}/t/${slug}/icon/${size}`,
        sizes: `${size}x${size}`,
        type: 'image/png',
        purpose,
      }))
    : FALLBACK_ICONS(origin)

  // Two sub-types: 'page' (customer-facing menu) and 'orders' (business owner orders dashboard)
  const isOrders = type === 'orders'

  const manifest = isOrders
    ? {
        id: `${origin}/t/${slug}/orders/`,
        name: `${name} Dashboard`,
        short_name: shortName,
        description: `${name} — Standalone business dashboard with order alerts`,
        start_url: `${origin}/t/${slug}/orders`,
        scope: `${origin}/t/${slug}/orders/`,
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#10b981',
        orientation: 'portrait-primary',
        icons,
        categories: ['business', 'productivity'],
      }
    : {
        id: `${origin}/t/${slug}/`,
        name,
        short_name: shortName,
        description: `${name} — Menu & order`,
        start_url: `${origin}/t/${slug}`,
        scope: `${origin}/t/${slug}/`,
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        orientation: 'portrait-primary',
        icons,
        categories: ['food', 'restaurant'],
      }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
    },
  })
}
