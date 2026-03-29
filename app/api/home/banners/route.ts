import { NextRequest } from 'next/server'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'

/** Cache 60s per (city, lang) to reduce Sanity API calls. */
export const revalidate = 60

type Dimensions = { width: number; height: number; aspectRatio?: number } | null
type SanityImage = { asset?: { _ref: string } } | undefined

function firstImage(...candidates: SanityImage[]): SanityImage {
  for (const c of candidates) {
    if (c?.asset?._ref) return c
  }
  return undefined
}

function dimsForRef(
  img: SanityImage,
  pairs: Array<{ img: SanityImage; dim: Dimensions }>
): Dimensions | null {
  const ref = img?.asset?._ref
  if (!ref) return null
  for (const { img: i, dim } of pairs) {
    if (i?.asset?._ref === ref) return dim ?? null
  }
  return null
}

/**
 * GET /api/home/banners?city=Jerusalem&lang=ar|en
 * All banners are returned (city filter only). Text and image URLs follow `lang` (ar/en).
 * Image banners: Arabic assets are default; English is used when set, else Arabic.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const city = searchParams.get('city') ?? ''
  const lang = (searchParams.get('lang') ?? 'ar').toLowerCase()
  const isEn = lang === 'en'

  type BannerDoc = {
    _id: string
    title?: string
    bannerType: string
    imageDesktopAr?: SanityImage
    imageDesktopEn?: SanityImage
    imageMobileAr?: SanityImage
    imageMobileEn?: SanityImage
    imageDesktop?: SanityImage
    imageMobile?: SanityImage
    ddAr?: Dimensions
    ddEn?: Dimensions
    dmAr?: Dimensions
    dmEn?: Dimensions
    ddLeg?: Dimensions
    dmLeg?: Dimensions
    textTitleAr?: string
    textTitleEn?: string
    textDescriptionAr?: string
    textDescriptionEn?: string
    textButtonLabelAr?: string
    textButtonLabelEn?: string
    backgroundColor?: string
    textColor?: string
    linkType: string
    tenant?: { slug?: { current?: string } }
    url?: string
    countries?: string[]
    cities?: string[]
    sortOrder?: number
  }

  const { banners: rawBanners, settings: bannerSettings } = await client.fetch<{
    banners: BannerDoc[]
    settings: { imageDurationSeconds?: number } | null
  }>(
    `{
      "banners": *[_type == "heroBanner" && (!defined(startDate) || startDate <= now()) && (!defined(endDate) || endDate >= now())] | order(sortOrder asc) {
        _id,
        title,
        bannerType,
        imageDesktopAr,
        imageDesktopEn,
        imageMobileAr,
        imageMobileEn,
        imageDesktop,
        imageMobile,
        "ddAr": imageDesktopAr.asset->metadata.dimensions,
        "ddEn": imageDesktopEn.asset->metadata.dimensions,
        "dmAr": imageMobileAr.asset->metadata.dimensions,
        "dmEn": imageMobileEn.asset->metadata.dimensions,
        "ddLeg": imageDesktop.asset->metadata.dimensions,
        "dmLeg": imageMobile.asset->metadata.dimensions,
        textTitleAr,
        textTitleEn,
        textDescriptionAr,
        textDescriptionEn,
        textButtonLabelAr,
        textButtonLabelEn,
        backgroundColor,
        textColor,
        linkType,
        tenant->{ "slug": slug.current },
        url,
        countries,
        cities,
        sortOrder
      },
      "settings": *[_type == "bannerSettings" && _id == "bannerSettings"][0]{ imageDurationSeconds }
    }`
  )

  const banners = rawBanners ?? []

  const imageDurationSeconds =
    bannerSettings?.imageDurationSeconds != null && bannerSettings.imageDurationSeconds >= 3 && bannerSettings.imageDurationSeconds <= 120
      ? bannerSettings.imageDurationSeconds
      : 10

  const DESKTOP_MAX = 1920
  const MOBILE_MAX = 768
  function toUrl(img: SanityImage, maxWidth: number): string | null {
    if (!img?.asset?._ref) return null
    return urlFor(img).width(maxWidth).fit('max').quality(90).url()
  }

  const cityNorm = (s: string) => s.trim().toLowerCase()
  const cityFiltered = (banners ?? []).filter((b) => {
    if (b.cities && b.cities.length > 0) {
      if (!city) return false
      const u = cityNorm(city)
      const match = b.cities.some((c) => cityNorm(c) === u)
      if (!match) return false
    }
    return true
  })

  const result = cityFiltered.map((b) => {
    let href: string | null = null
    if (b.linkType === 'tenant' && b.tenant?.slug) {
      href = `/t/${b.tenant.slug}`
    } else if (b.linkType === 'url' && b.url) {
      href = b.url
    }

    const legD = b.imageDesktop
    const legM = b.imageMobile
    const dAr = firstImage(b.imageDesktopAr, legD)
    const dEn = b.imageDesktopEn
    const mAr = firstImage(b.imageMobileAr, legM, dAr)
    const mEn = b.imageMobileEn

    const dimPairs: Array<{ img: SanityImage; dim: Dimensions }> = [
      { img: b.imageDesktopAr, dim: b.ddAr ?? null },
      { img: b.imageDesktopEn, dim: b.ddEn ?? null },
      { img: b.imageMobileAr, dim: b.dmAr ?? null },
      { img: b.imageMobileEn, dim: b.dmEn ?? null },
      { img: legD, dim: b.ddLeg ?? null },
      { img: legM, dim: b.dmLeg ?? null },
    ]

    const hasDesktopImage = Boolean(
      firstImage(dEn, dAr)?.asset?._ref
    )
    const hasTextFields = Boolean(
      (b.textTitleAr && b.textTitleAr.trim()) ||
        (b.textTitleEn && b.textTitleEn.trim()) ||
        (b.textDescriptionAr && b.textDescriptionAr.trim()) ||
        (b.textDescriptionEn && b.textDescriptionEn.trim()) ||
        (b.textButtonLabelAr && b.textButtonLabelAr.trim()) ||
        (b.textButtonLabelEn && b.textButtonLabelEn.trim())
    )
    const isTextBanner =
      b.bannerType === 'text' || (!hasDesktopImage && hasTextFields)

    if (isTextBanner) {
      return {
        _id: b._id,
        bannerType: 'text',
        href,
        textTitle: isEn ? (b.textTitleEn || b.textTitleAr) : (b.textTitleAr || b.textTitleEn),
        textDescription: isEn ? (b.textDescriptionEn || b.textDescriptionAr) : (b.textDescriptionAr || b.textDescriptionEn),
        textButtonLabel: isEn ? (b.textButtonLabelEn || b.textButtonLabelAr) : (b.textButtonLabelAr || b.textButtonLabelEn),
        backgroundColor: b.backgroundColor || '#111827',
        textColor: b.textColor || '#ffffff',
      }
    }

    const desktopImg = isEn ? firstImage(dEn, dAr) : firstImage(dAr, dEn)
    const mobileImg = isEn
      ? firstImage(mEn, mAr, dEn, dAr)
      : firstImage(mAr, mEn, dAr, dEn)

    const urlFromDesktopField = toUrl(desktopImg, DESKTOP_MAX)
    const urlFromMobileField = toUrl(mobileImg, MOBILE_MAX)

    const imageUrlDesktopResolved = urlFromDesktopField ?? urlFromMobileField
    const imageUrlMobileResolved = urlFromMobileField ?? urlFromDesktopField

    if (!imageUrlDesktopResolved && !imageUrlMobileResolved) return null

    const desktopDims = dimsForRef(desktopImg, dimPairs)
    const mobileDims =
      !urlFromMobileField || imageUrlMobileResolved === imageUrlDesktopResolved
        ? desktopDims
        : dimsForRef(mobileImg, dimPairs)

    return {
      _id: b._id,
      bannerType: 'image',
      imageUrlDesktop: imageUrlDesktopResolved,
      imageUrlMobile: imageUrlMobileResolved,
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
