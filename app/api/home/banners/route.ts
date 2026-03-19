import { NextRequest } from 'next/server'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'

/** Cache 60s per (city, lang) to reduce Sanity API calls. */
export const revalidate = 60

/**
 * GET /api/home/banners?city=Jerusalem&lang=ar|en
 * Returns hero banners. Filters by city when provided. Language: ar default, en falls back to ar.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const city = searchParams.get('city') ?? ''
  const lang = searchParams.get('lang') ?? 'ar'

  type Dimensions = { width: number; height: number; aspectRatio?: number } | null
  type BannerDoc = {
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
    desktopDimensions?: Dimensions
    mobileDimensions?: Dimensions
  }

  const { banners: rawBanners, settings: bannerSettings } = await client.fetch<{
    banners: BannerDoc[]
    settings: { imageDurationSeconds?: number } | null
  }>(
    `{
      "banners": *[_type == "heroBanner" && (!defined(startDate) || startDate <= now()) && (!defined(endDate) || endDate >= now())] | order(sortOrder asc) {
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
        "desktopDimensions": coalesce(
          imageDesktopAr.asset->metadata.dimensions,
          imageDesktopEn.asset->metadata.dimensions,
          image.asset->metadata.dimensions
        ),
        "mobileDimensions": coalesce(
          imageMobileAr.asset->metadata.dimensions,
          imageMobileEn.asset->metadata.dimensions,
          imageDesktopAr.asset->metadata.dimensions,
          imageDesktopEn.asset->metadata.dimensions,
          image.asset->metadata.dimensions
        ),
        "videoDesktopArUrl": videoDesktopAr.asset->url,
        "videoDesktopEnUrl": videoDesktopEn.asset->url,
        "videoMobileArUrl": videoMobileAr.asset->url,
        "videoMobileEnUrl": videoMobileEn.asset->url
      },
      "settings": *[_type == "bannerSettings" && _id == "bannerSettings"][0]{ imageDurationSeconds }
    }`
  )

  const banners = rawBanners ?? []

  const imageDurationSeconds =
    bannerSettings?.imageDurationSeconds != null && bannerSettings.imageDurationSeconds >= 3 && bannerSettings.imageDurationSeconds <= 120
      ? bannerSettings.imageDurationSeconds
      : 10

  // High-quality URLs: preserve aspect ratio (fit max), 2x for retina, quality 90
  const DESKTOP_MAX = 1920
  const MOBILE_MAX = 768
  function toUrl(
    img: { asset?: { _ref: string } } | null | undefined,
    maxWidth: number
  ): string | null {
    if (!img?.asset?._ref) return null
    return urlFor(img).width(maxWidth).fit('max').quality(90).url()
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

    const urlFromDesktopField = toUrl(desktopImg, DESKTOP_MAX)
    const urlFromMobileField = toUrl(mobileImg, MOBILE_MAX)

    // Fix: Desktop viewport → Desktop Image (1130×320), mobile viewport → Mobile Image (320×320)
    const imageUrlDesktopResolved = urlFromDesktopField ?? urlFromMobileField
    const imageUrlMobileResolved = urlFromMobileField ?? urlFromDesktopField

    const videoUrlDesktop = videoDesktop && videoDesktop.length > 0 ? videoDesktop : null
    const videoUrlMobile = videoMobile && videoMobile.length > 0 ? videoMobile : null

    if (!imageUrlDesktopResolved && !imageUrlMobileResolved && !videoUrlDesktop && !videoUrlMobile)
      return null

    const desktopDims = b.desktopDimensions
    const mobileDims = b.mobileDimensions

    return {
      _id: b._id,
      imageUrlDesktop: imageUrlDesktopResolved,
      imageUrlMobile: imageUrlMobileResolved,
      videoUrlDesktop: videoUrlDesktop ?? null,
      videoUrlMobile: videoUrlMobile ?? null,
      href,
      desktopAspect:
        desktopDims?.width && desktopDims?.height
          ? desktopDims.width / desktopDims.height
          : null,
      mobileAspect:
        mobileDims?.width && mobileDims?.height
          ? mobileDims.width / mobileDims.height
          : null,
    }
  }).filter((x): x is NonNullable<typeof x> => x != null)

  return Response.json({ banners: result, imageDurationSeconds })
}
