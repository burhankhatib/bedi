import { NextRequest } from 'next/server'
import { getTenantBySlug } from '@/lib/tenant'
import { client } from '@/sanity/lib/client'

/** Legacy per-business manifest endpoint kept for compatibility. Mirrors Orders manifest behavior. */
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

  const name = restaurantInfo?.name_en || tenant.name || 'Dashboard'
  const shortName = name.length > 12 ? name.slice(0, 11) + '…' : name
  const startUrl = `${origin}/t/${slug}/orders`
  const scope = `${origin}/t/${slug}/`

  let icons: Array<{ src: string; sizes: string; type: string; purpose: string }>
  if (restaurantInfo?.logo) {
    icons = [
      { src: `${origin}/t/${slug}/icon/192`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${origin}/t/${slug}/icon/512`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ]
  } else {
    icons = [
      { src: `${origin}/adminslogo.webp`, sizes: '192x192', type: 'image/webp', purpose: 'any' },
      { src: `${origin}/adminslogo.webp`, sizes: '512x512', type: 'image/webp', purpose: 'any maskable' },
    ]
  }

  const manifest = {
    id: `${origin}/t/${slug}/orders/`,
    name: `${name} Dashboard`,
    short_name: shortName,
    description: `${name} — Standalone business dashboard`,
    start_url: startUrl,
    scope: `${origin}/t/${slug}/orders/`,
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    background_color: '#0f172a',
    theme_color: '#0f172a',
    orientation: 'portrait-primary',
    icons,
    categories: ['business', 'productivity'],
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
    },
  })
}
