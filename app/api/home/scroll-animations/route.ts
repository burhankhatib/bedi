import { NextRequest } from 'next/server'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'

export const revalidate = 60

/**
 * GET /api/home/scroll-animations?city=Jerusalem
 * Returns the best-matching scroll animation for the user's location.
 * Frames are returned as optimised Sanity CDN image URLs.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const city = searchParams.get('city') ?? ''

  type FrameAsset = { asset?: { _ref: string } }
  type AnimationDoc = {
    _id: string
    title: string
    frames: FrameAsset[]
    scrollHeight: number
    countries?: string[]
    cities?: string[]
    sortOrder?: number
  }

  const animations = await client.fetch<AnimationDoc[]>(
    `*[
      _type == "scrollAnimation"
      && enabled == true
      && (!defined(startDate) || startDate <= now())
      && (!defined(endDate) || endDate >= now())
    ] | order(sortOrder asc) {
      _id,
      title,
      frames,
      scrollHeight,
      countries,
      cities,
      sortOrder
    }`
  )

  if (!animations || animations.length === 0) {
    return Response.json({ animation: null })
  }

  const cityLower = city.toLowerCase()

  let matched: AnimationDoc | undefined

  // First pass: find an animation that targets this specific city
  if (city) {
    matched = animations.find((a) => {
      if (!a.cities || a.cities.length === 0) return false
      return a.cities.some((c) => c.toLowerCase() === cityLower)
    })
  }

  // Second pass: find an animation with no city/country restrictions (global)
  if (!matched) {
    matched = animations.find((a) => {
      const noCityFilter = !a.cities || a.cities.length === 0
      const noCountryFilter = !a.countries || a.countries.length === 0
      return noCityFilter && noCountryFilter
    })
  }

  // Last resort: first animation in sort order
  if (!matched) {
    matched = animations[0]
  }

  if (!matched) {
    return Response.json({ animation: null })
  }

  const FRAME_WIDTH = 1080

  const frameUrls = (matched.frames ?? [])
    .map((f) => {
      if (!f?.asset?._ref) return null
      return urlFor(f).width(FRAME_WIDTH).quality(85).url()
    })
    .filter((url): url is string => url != null)

  return Response.json({
    animation: {
      _id: matched._id,
      title: matched.title,
      scrollHeight: matched.scrollHeight ?? 400,
      frameCount: frameUrls.length,
      frames: frameUrls,
    },
  })
}
