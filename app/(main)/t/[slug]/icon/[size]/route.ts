import { NextRequest } from 'next/server'
import sharp from 'sharp'
import { getTenantBySlug } from '@/lib/tenant'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'

const ALLOWED_SIZES = [48, 72, 96, 128, 144, 152, 192, 256, 384, 512]

/** Theme background for icons (no transparency → no black circle on install/splash) */
const ICON_BG = { r: 255, g: 255, b: 255, alpha: 1 } // #ffffff

/** GET tenant PWA icon at the given size. Renders logo on solid background so install/splash never show a black circle. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; size: string }> }
) {
  const { slug, size: sizeParam } = await params
  const size = parseInt(sizeParam, 10)
  if (!ALLOWED_SIZES.includes(size)) {
    return new Response('Invalid size', { status: 400 })
  }

  const tenant = await getTenantBySlug(slug)
  if (!tenant) {
    return new Response('Not found', { status: 404 })
  }

  const restaurantInfo = await client.fetch<{
    logo?: { _type: string; asset?: { _ref: string } }
  } | null>(
    `*[_type == "restaurantInfo" && site._ref == $siteId][0]{ logo }`,
    { siteId: tenant._id }
  )

  if (!restaurantInfo?.logo) {
    const base = new URL(req.url)
    const defaultIconUrl = new URL(`/icons/icon-${sizeParam}x${sizeParam}.png`, base.origin)
    return Response.redirect(defaultIconUrl, 302)
  }

  const imageUrl = urlFor(restaurantInfo.logo).width(size).height(size).format('png').url()
  const imageRes = await fetch(imageUrl, { cache: 'force-cache' })
  if (!imageRes.ok) {
    return new Response('Failed to fetch image', { status: 502 })
  }

  const arrayBuffer = await imageRes.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  try {
    const png = await sharp(buffer)
      .resize(size, size, {
        fit: 'contain',
        background: ICON_BG,
      })
      .png()
      .toBuffer()

    return new Response(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    })
  } catch (e) {
    console.error('[Tenant icon] sharp error:', e)
    return new Response('Failed to process image', { status: 502 })
  }
}
