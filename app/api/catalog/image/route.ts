import { NextRequest, NextResponse } from 'next/server'

export const revalidate = 0

type UnsplashSearchResponse = {
  results?: Array<{
    id: string
    urls?: { regular?: string; small?: string }
    user?: { name?: string; links?: { html?: string } }
  }>
}

/**
 * GET /api/catalog/image?query=carton%20of%20eggs
 * Proxies Unsplash search and returns one curated image URL.
 */
export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get('query') ?? '').trim()
  if (!query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) {
    return NextResponse.json({ error: 'UNSPLASH_ACCESS_KEY is missing' }, { status: 500 })
  }

  const url = new URL('https://api.unsplash.com/search/photos')
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', '1')
  url.searchParams.set('orientation', 'squarish')
  url.searchParams.set('content_filter', 'high')
  url.searchParams.set('order_by', 'relevant')

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
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
    const photo = data.results?.[0]
    if (!photo?.urls?.regular && !photo?.urls?.small) {
      return NextResponse.json({ error: 'No image found' }, { status: 404 })
    }

    return NextResponse.json(
      {
        id: photo.id,
        imageUrl: photo.urls?.regular ?? photo.urls?.small ?? null,
        imageUrlSmall: photo.urls?.small ?? photo.urls?.regular ?? null,
        photographer: photo.user?.name ?? null,
        photographerUrl: photo.user?.links?.html ?? null,
      },
      { headers: { 'Cache-Control': 'private, max-age=3600' } }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch Unsplash image', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}

