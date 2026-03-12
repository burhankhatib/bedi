import { NextRequest, NextResponse } from 'next/server'

export const revalidate = 0

type UnsplashSearchResponse = {
  results?: Array<{
    id: string
    urls?: { regular?: string; small?: string }
    user?: { name?: string; links?: { html?: string } }
  }>
}

type ImageResult = {
  id: string
  imageUrl: string
  imageUrlSmall: string
  photographer?: string
  photographerUrl?: string
}

/**
 * GET /api/catalog/image?query=carton%20of%20eggs&count=5&page=1
 * Proxies Unsplash search. Returns one image by default, or up to 5 with count=5. page=1,2,... for refresh.
 */
export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get('query') ?? '').trim()
  const count = Math.min(5, Math.max(1, parseInt(req.nextUrl.searchParams.get('count') ?? '1', 10) || 1))
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10) || 1)

  if (!query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) {
    return NextResponse.json({ error: 'UNSPLASH_ACCESS_KEY is missing' }, { status: 500 })
  }

  // Prefer studio product-style images (clean, professional) over general lifestyle shots
  const studioQuery = `${query} product photography studio`

  const url = new URL('https://api.unsplash.com/search/photos')
  url.searchParams.set('query', studioQuery)
  url.searchParams.set('per_page', String(count))
  url.searchParams.set('page', String(page))
  url.searchParams.set('orientation', 'squarish')
  url.searchParams.set('content_filter', 'high')
  url.searchParams.set('order_by', 'relevant')

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${accessKey}` },
      cache: 'no-store',
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return NextResponse.json(
        { error: 'Unsplash request failed', status: res.status, details: body || undefined },
        { status: 502 }
      )
    }

    const data = (await res.json()) as UnsplashSearchResponse
    const results: ImageResult[] = (data.results ?? [])
      .filter((p) => p?.urls?.regular || p?.urls?.small)
      .slice(0, count)
      .map((p) => ({
        id: p.id,
        imageUrl: p.urls?.regular ?? p.urls?.small ?? '',
        imageUrlSmall: p.urls?.small ?? p.urls?.regular ?? '',
        photographer: p.user?.name,
        photographerUrl: p.user?.links?.html,
      }))

    if (results.length === 0) {
      return NextResponse.json({ error: 'No images found', images: [] }, { status: 404 })
    }

    return NextResponse.json(
      count === 1
        ? { ...results[0], images: undefined }
        : { images: results, imageUrl: results[0]?.imageUrl, imageUrlSmall: results[0]?.imageUrlSmall },
      { headers: { 'Cache-Control': 'private, max-age=3600' } }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch Unsplash image', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}

