import { NextRequest } from 'next/server'
import { client } from '@/sanity/lib/client'

const FALLBACK_ICONS = [
  { src: '/icons/icon-48x48.png', sizes: '48x48', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
  { src: '/icons/icon-256x256.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
]

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
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
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  
  const tenant = result
  const restaurantInfo = result.restaurantInfo

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const origin = `${protocol}://${host}`

  const name = restaurantInfo?.name_en || tenant.name || 'Menu'
  const shortName = name.length > 12 ? name.slice(0, 11) + '…' : name
  const startUrl = `${origin}/t/${slug}`

  let icons: Array<{ src: string; sizes: string; type: string; purpose: string }>
  if (restaurantInfo?.logo) {
    // Same-origin icon URLs so the PWA uses the tenant's logo (all sizes for install + splash)
    const sizes: Array<{ size: number; purpose: string }> = [
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
    icons = sizes.map(({ size, purpose }) => ({
      src: `${origin}/t/${slug}/icon/${size}`,
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose,
    }))
  } else {
    icons = FALLBACK_ICONS.map((i) => ({ ...i, src: origin + i.src }))
  }

  const manifest = {
    id: `${origin}/t/${slug}`,
    name,
    short_name: shortName,
    description: `${name} — Menu & order`,
    start_url: startUrl,
    scope: `${origin}/t/${slug}`,
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    orientation: 'portrait-primary',
    icons,
    categories: ['food', 'restaurant'],
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
    },
  })
}
