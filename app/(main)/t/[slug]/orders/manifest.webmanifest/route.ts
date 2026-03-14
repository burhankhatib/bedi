import { NextRequest } from 'next/server'
import { getTenantBySlug } from '@/lib/tenant'
import { client } from '@/sanity/lib/client'

const FALLBACK_ICONS = [
  { src: '/icons/icon-48x48.png', sizes: '48x48', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
  { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
]

/** Per-business PWA manifest. Used from both /manage and /orders; always opens Orders by default. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const restaurantInfo = await client.fetch<{
    name_en?: string
    name_ar?: string
    logo?: { _type: string; asset?: { _ref: string } }
  } | null>(
    `*[_type == "restaurantInfo" && site._ref == $siteId][0]{ name_en, name_ar, logo }`,
    { siteId: tenant._id }
  )

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const origin = `${protocol}://${host}`

  const businessName = restaurantInfo?.name_en || tenant.name || 'Business'
  const name = `${businessName} Dashboard`
  const shortName = name.length > 12 ? name.slice(0, 11) + '…' : name
  const startUrl = `${origin}/t/${slug}/orders`
  const scope = `${origin}/t/${slug}/`

  let icons: Array<{ src: string; sizes: string; type: string; purpose: string }>
  if (restaurantInfo?.logo) {
    const sizes = [48, 192, 512]
    icons = sizes.map((size) => ({
      src: `${origin}/t/${slug}/icon/${size}`,
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: size >= 192 ? 'any maskable' : 'any',
    }))
  } else {
    icons = FALLBACK_ICONS.map((i) => ({ ...i, src: origin + i.src }))
  }

  const manifest = {
    id: `${origin}/t/${slug}/orders/`,
    name,
    short_name: shortName,
    description: `${businessName} — Standalone business dashboard with order alerts`,
    start_url: startUrl,
    scope: `${origin}/t/${slug}/orders/`,
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    orientation: 'portrait-primary',
    icons,
    categories: ['business', 'food'],
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      // Cache 5 min — manifest (name, icon URLs) rarely changes. Reduces Sanity API usage when many tenants keep Orders open.
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
    },
  })
}
