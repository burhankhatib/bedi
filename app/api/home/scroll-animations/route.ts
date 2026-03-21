import { NextRequest } from 'next/server'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'

export const revalidate = 60

type FrameAsset = { asset?: { _ref: string } }
type AnimationDoc = {
  _id: string
  title: string
  frames: FrameAsset[]
  scrollHeight: number
  countries?: string[]
  cities?: string[]
  sortOrder?: number
  /** 1–10, higher = more important (default 5 for legacy docs) */
  priority?: number
}

function animationAppliesToVisitor(a: AnimationDoc, cityLower: string): boolean {
  const hasCities = !!(a.cities && a.cities.length > 0)
  const hasCountries = !!(a.countries && a.countries.length > 0)
  if (!hasCities && !hasCountries) return true
  if (hasCities) {
    if (!cityLower) return false
    return a.cities!.some((c) => c.toLowerCase() === cityLower)
  }
  if (hasCountries && !hasCities) return false
  return false
}

function sortByPriorityThenOrder(a: AnimationDoc, b: AnimationDoc): number {
  const pa = typeof a.priority === 'number' ? a.priority : 5
  const pb = typeof b.priority === 'number' ? b.priority : 5
  if (pb !== pa) return pb - pa
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
}

const FRAME_WIDTH = 1080

function toPayload(matched: AnimationDoc) {
  const frameUrls = (matched.frames ?? [])
    .map((f) => {
      if (!f?.asset?._ref) return null
      return urlFor(f).width(FRAME_WIDTH).quality(85).url()
    })
    .filter((url): url is string => url != null)

  return {
    _id: matched._id,
    title: matched.title,
    scrollHeight: matched.scrollHeight ?? 400,
    frameCount: frameUrls.length,
    frames: frameUrls,
    priority: typeof matched.priority === 'number' ? matched.priority : 5,
  }
}

/**
 * GET /api/home/scroll-animations?city=Jerusalem
 * Returns all matching scroll animations for the visitor, ordered by priority (10 first), then sortOrder.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const city = searchParams.get('city') ?? ''
  const cityLower = city.toLowerCase()

  const animations = await client.fetch<AnimationDoc[]>(
    `*[
      _type == "scrollAnimation"
      && enabled == true
      && (!defined(startDate) || startDate <= now())
      && (!defined(endDate) || endDate >= now())
    ] | order(coalesce(priority, 5) desc, sortOrder asc) {
      _id,
      title,
      frames,
      scrollHeight,
      countries,
      cities,
      sortOrder,
      priority
    }`
  )

  if (!animations || animations.length === 0) {
    return Response.json({ animations: [], animation: null })
  }

  let matched = animations.filter((a) => animationAppliesToVisitor(a, cityLower))
  if (matched.length === 0) {
    matched = [...animations]
  }

  matched.sort(sortByPriorityThenOrder)

  const payloads = matched
    .map(toPayload)
    .filter((p) => p.frames.length >= 2)

  return Response.json({
    animations: payloads,
    /** @deprecated use `animations[0]` — kept for older clients */
    animation: payloads[0] ?? null,
  })
}
