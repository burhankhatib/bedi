import { NextRequest } from 'next/server'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'

/**
 * GET /api/home/banners?city=Jerusalem&lang=ar|en
 * Returns hero banners. Filters by city when provided. Language: ar default, en falls back to ar.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const city = searchParams.get('city') ?? ''
  const lang = searchParams.get('lang') ?? 'ar'

  const [banners, bannerSettings] = await Promise.all([
    client.fetch<
    Array<{
      _id: string
      image: { asset?: { _ref: string } }
      imageDesktopAr?: { asset?: { _ref: string } }
      imageDesktopEn?: { asset?: { _ref: string } }
      imageMobileAr?: { asset?: { _ref: string } }
      imageMobileEn?: { asset?: { _ref: string } }
      linkType: string
      tenant?: { slug?: { current?: string } }
      url?: string
      countries?: string[]
      cities?: string[]
      sortOrder?: number
      language?: string
      height?: string
      preferredDesktopWidth?: number
      preferredDesktopHeight?: number
      preferredMobileWidth?: number
      preferredMobileHeight?: number
      videoDesktopArUrl?: string | null
      videoDesktopEnUrl?: string | null
      videoMobileArUrl?: string | null
      videoMobileEnUrl?: string | null
    }>
  >(
    `*[_type == "heroBanner" && (!defined(startDate) || startDate <= now()) && (!defined(endDate) || endDate >= now())] | order(sortOrder asc) {
      _id,
      image,
      imageDesktopAr,
      imageDesktopEn,
      imageMobileAr,
      imageMobileEn,
      linkType,
      tenant->{ "slug": slug.current },
      url,
      countries,
      cities,
      sortOrder,
      language,
      height,
      preferredDesktopWidth,
      preferredDesktopHeight,
      preferredMobileWidth,
      preferredMobileHeight,
      "videoDesktopArUrl": videoDesktopAr.asset->url,
      "videoDesktopEnUrl": videoDesktopEn.asset->url,
      "videoMobileArUrl": videoMobileAr.asset->url,
      "videoMobileEnUrl": videoMobileEn.asset->url
    }`
    ),
    client.fetch<{ imageDurationSeconds?: number } | null>(
      `*[_type == "bannerSettings" && _id == "bannerSettings"][0]{ imageDurationSeconds }`
    ),
  ])

  const imageDurationSeconds =
    bannerSettings?.imageDurationSeconds != null && bannerSettings.imageDurationSeconds >= 3 && bannerSettings.imageDurationSeconds <= 120
      ? bannerSettings.imageDurationSeconds
      : 10

  function toUrl(img: { asset?: { _ref: string } } | null | undefined, w: number, h: number): string | null {
    if (!img?.asset?._ref) return null
    return urlFor(img).width(w).height(h).url()
  }

  const cityFiltered = (banners ?? []).filter((b) => {
    if (b.cities && b.cities.length > 0) {
      if (!city || !b.cities.includes(city)) return false
    }
    return true
  })

  const langPreferred = cityFiltered.filter((b) => {
    const bannerLang = (b.language ?? 'ar').toLowerCase()
    return bannerLang === (lang === 'en' ? 'en' : 'ar')
  })

  const langFallback = cityFiltered.filter((b) => {
    const bannerLang = (b.language ?? 'ar').toLowerCase()
    return bannerLang === 'ar'
  })

  const byLang = langPreferred.length > 0 ? langPreferred : langFallback

  const result = byLang.map((b) => {
    let href: string | null = null
    if (b.linkType === 'tenant' && b.tenant?.slug) {
      href = `/t/${b.tenant.slug}`
    } else if (b.linkType === 'url' && b.url) {
      href = b.url
    }

    const desktopAr = b.imageDesktopAr
    const desktopEn = b.imageDesktopEn
    const mobileAr = b.imageMobileAr
    const mobileEn = b.imageMobileEn
    const legacy = b.image

    const desktopImg =
      (lang === 'en' ? desktopEn : desktopAr) ??
      desktopAr ??
      desktopEn ??
      legacy
    const mobileImg =
      (lang === 'en' ? mobileEn : mobileAr) ??
      mobileAr ??
      mobileEn ??
      (lang === 'en' ? desktopEn : desktopAr) ??
      desktopAr ??
      desktopEn ??
      legacy

    const videoDesktop =
      (lang === 'en' ? b.videoDesktopEnUrl : b.videoDesktopArUrl) ??
      b.videoDesktopArUrl ??
      b.videoDesktopEnUrl ??
      null
    const videoMobile =
      (lang === 'en' ? b.videoMobileEnUrl : b.videoMobileArUrl) ??
      b.videoMobileArUrl ??
      b.videoMobileEnUrl ??
      (lang === 'en' ? b.videoDesktopEnUrl : b.videoDesktopArUrl) ??
      b.videoDesktopArUrl ??
      b.videoDesktopEnUrl ??
      null

    const heightMap: Record<string, number> = { small: 420, medium: 560, large: 780, full: 1080 }
    const desktopW = b.preferredDesktopWidth ?? 1920
    const desktopH = b.preferredDesktopHeight ?? heightMap[(b.height as string) || 'medium'] ?? 560
    const mobileW = b.preferredMobileWidth ?? 768
    const mobileH = b.preferredMobileHeight ?? 420

    const imageUrlDesktop = toUrl(desktopImg, desktopW, desktopH)
    const imageUrlMobile = toUrl(mobileImg, mobileW, mobileH)

    const imageUrlDesktopResolved = imageUrlDesktop ?? imageUrlMobile
    const imageUrlMobileResolved = imageUrlMobile ?? imageUrlDesktop

    const videoUrlDesktop = videoDesktop && videoDesktop.length > 0 ? videoDesktop : null
    const videoUrlMobile = videoMobile && videoMobile.length > 0 ? videoMobile : null

    if (!imageUrlDesktopResolved && !imageUrlMobileResolved && !videoUrlDesktop && !videoUrlMobile)
      return null

    return {
      _id: b._id,
      imageUrlDesktop: imageUrlDesktopResolved,
      imageUrlMobile: imageUrlMobileResolved,
      videoUrlDesktop: videoUrlDesktop ?? null,
      videoUrlMobile: videoUrlMobile ?? null,
      href,
      height: (b.height as string) || 'medium',
      preferredDesktopWidth: b.preferredDesktopWidth ?? null,
      preferredDesktopHeight: b.preferredDesktopHeight ?? null,
      preferredMobileWidth: b.preferredMobileWidth ?? null,
      preferredMobileHeight: b.preferredMobileHeight ?? null,
    }
  }).filter((x): x is NonNullable<typeof x> => x != null)

  return Response.json({ banners: result, imageDurationSeconds })
}
