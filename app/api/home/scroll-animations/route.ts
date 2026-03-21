import { NextRequest } from 'next/server'
import { unstable_cache } from 'next/cache'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'
import { inferScrollRegionFromCity } from '@/lib/location-config'

/**
 * Handler runs every request (uniform random pick). Sanity + eligibility are data-cached.
 */
export const dynamic = 'force-dynamic'

const REVALIDATE_SECONDS = 60

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

function hasExplicitGeoTargeting(a: AnimationDoc): boolean {
  const hasCities = !!(a.cities && a.cities.length > 0)
  const hasCountries = !!(a.countries && a.countries.length > 0)
  return hasCities || hasCountries
}

/**
 * City and country filters are independent; at least one must be set on the document
 * (see Studio validation). Visitor must pass every dimension the document defines.
 */
function animationAppliesToVisitor(
  a: AnimationDoc,
  cityLower: string,
  visitorRegion: 'palestine' | 'jerusalem' | null
): boolean {
  if (!hasExplicitGeoTargeting(a)) return false

  const hasCities = !!(a.cities && a.cities.length > 0)
  const hasCountries = !!(a.countries && a.countries.length > 0)

  const cityOk =
    !hasCities ||
    (cityLower !== '' && a.cities!.some((c) => c.toLowerCase() === cityLower))

  const countryOk =
    !hasCountries ||
    (visitorRegion != null &&
      a.countries!.some((c) => c.toLowerCase() === visitorRegion.toLowerCase()))

  return cityOk && countryOk
}

function countValidFrames(a: AnimationDoc): number {
  return (a.frames ?? []).filter((f) => f?.asset?._ref).length
}

function pickRandom<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined
  const i = Math.floor(Math.random() * items.length)
  return items[i]
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
  }
}

async function fetchScrollAnimationDocsFromSanity(): Promise<AnimationDoc[]> {
  return client.fetch<AnimationDoc[]>(
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
}

const getCachedScrollAnimationDocs = unstable_cache(
  fetchScrollAnimationDocsFromSanity,
  ['home-scroll-animations-sanity'],
  { revalidate: REVALIDATE_SECONDS, tags: ['scroll-animations'] }
)

function regionFromCacheKey(regionKey: string): 'palestine' | 'jerusalem' | null {
  if (regionKey === 'palestine' || regionKey === 'jerusalem') return regionKey
  return null
}

const getCachedEligibleScrollDocs = unstable_cache(
  async (cityLower: string, regionKey: string) => {
    const animations = await getCachedScrollAnimationDocs()
    if (!animations?.length) return []
    const visitorRegion = regionFromCacheKey(regionKey)
    return animations
      .filter((a) => animationAppliesToVisitor(a, cityLower, visitorRegion))
      .filter((a) => countValidFrames(a) >= 2)
  },
  ['home-scroll-animations-eligible'],
  { revalidate: REVALIDATE_SECONDS, tags: ['scroll-animations'] }
)

const JSON_NO_STORE = {
  'Cache-Control': 'private, no-store, must-revalidate',
  Vary: 'Accept-Encoding',
} as const

/**
 * GET /api/home/scroll-animations?city=Bethany
 * Returns **one** randomly chosen animation among those whose country/city rules match.
 * Documents with no city and no country are never returned (must be explicitly targeted).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const city = (searchParams.get('city') ?? '').trim()
  const cityLower = city.toLowerCase()
  const visitorRegion = city ? inferScrollRegionFromCity(city) : null
  const regionKey = visitorRegion ?? ''

  const matched = [...(await getCachedEligibleScrollDocs(cityLower, regionKey))]
  if (matched.length === 0) {
    return Response.json({ animation: null, animations: [] }, { headers: JSON_NO_STORE })
  }

  const chosen = pickRandom(matched)
  if (!chosen) {
    return Response.json({ animation: null, animations: [] }, { headers: JSON_NO_STORE })
  }

  const payload = toPayload(chosen)
  if (payload.frames.length < 2) {
    return Response.json({ animation: null, animations: [] }, { headers: JSON_NO_STORE })
  }

  return Response.json(
    {
      animation: payload,
      animations: [payload],
    },
    { headers: JSON_NO_STORE }
  )
}
