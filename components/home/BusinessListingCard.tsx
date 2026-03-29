'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Store, Heart, Clock } from 'lucide-react'
import { FullPageLink } from '@/components/ui/FullPageLink'
import { BUSINESS_TYPES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { BUSINESS_LISTING_CARD_GRID_CLASS } from '@/lib/ui/businessListingGrid'
import { useAdaptiveLogoBackground } from '@/components/home/useAdaptiveLogoBackground'

import { EntityRatingBadge } from '@/components/rating/EntityRatingBadge'

export { BUSINESS_LISTING_CARD_GRID_CLASS }

type LocalizedSection = { en: string; ar: string }

export type BusinessListingCardProps = {
  href: string
  logoUrl: string | null
  displayName: string
  businessType: string
  freeDeliveryEnabled?: boolean
  sections?: LocalizedSection[]
  lang: string
  t: (en: string, ar: string) => string
  useFullPageLink?: boolean
  titleTag?: 'h2' | 'h3'
  className?: string
  dir?: 'ltr' | 'rtl'
  rating?: { averageScore: number; totalCount: number } | null
  computedDeliveryFee?: number | null
  etaMinutes?: number | null
  estimatedTravelMinutes?: number | null
  estimatedPrepMinutes?: number | null
  hasActiveDeal?: boolean
}

export function BusinessListingCard({
  href,
  logoUrl,
  displayName,
  businessType,
  freeDeliveryEnabled = false,
  sections,
  lang,
  t,
  useFullPageLink = false,
  titleTag = 'h3',
  className,
  dir,
  rating,
  computedDeliveryFee,
  etaMinutes,
  estimatedTravelMinutes,
  estimatedPrepMinutes,
  hasActiveDeal,
}: BusinessListingCardProps) {
  const { containerRef, backgroundColor } = useAdaptiveLogoBackground(logoUrl)

  const typeLabel =
    lang === 'ar'
      ? BUSINESS_TYPES.find((b) => b.value === businessType)?.labelAr ?? businessType
      : BUSINESS_TYPES.find((b) => b.value === businessType)?.label ?? businessType

  const minutesWord = t('min', 'دقيقة')
  const estimationLine =
    etaMinutes != null
      ? t(
          `Estimation time ~${etaMinutes} ${minutesWord}`,
          `وقت تقديري ~${etaMinutes} ${minutesWord}`
        )
      : t('Estimation time ~25 min', 'وقت تقديري ~25 دقيقة')
  const breakdown =
    estimatedTravelMinutes != null && estimatedPrepMinutes != null
      ? t(
          `(${estimatedTravelMinutes} ${minutesWord} trip + ${estimatedPrepMinutes} ${minutesWord} prep)`,
          `(${estimatedTravelMinutes} ${minutesWord} مشوار + ${estimatedPrepMinutes} ${minutesWord} تحضير)`
        )
      : null
  const deliveryFee = freeDeliveryEnabled || computedDeliveryFee === 0 
    ? t('Free delivery', 'توصيل مجاني') 
    : computedDeliveryFee 
      ? t(`₪${computedDeliveryFee} delivery fee`, `₪${computedDeliveryFee} رسوم توصيل`)
      : t('₪10 delivery fee', '₪10 رسوم توصيل')

  const inner = (
    <div className="flex flex-col gap-3 group w-full outline-none">
      {/* Logo tile: full logo (contain), mat color from edge sampling or white if transparent */}
      <div
        ref={containerRef}
        className="relative w-full aspect-[4/3] sm:aspect-[16/9] overflow-hidden rounded-2xl ring-1 ring-black/5 transition-[background-color] duration-300 ease-out"
        style={{ backgroundColor: logoUrl ? (backgroundColor ?? '#ffffff') : undefined }}
      >
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={displayName}
            fill
            className="object-contain object-center p-3 sm:p-5 transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            sizes="(max-width: 639px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-100">
            <Store className="size-10 text-slate-300" />
          </div>
        )}
        
        {/* Heart Icon (Mock Favorite) */}
        <button type="button" className="absolute top-3 right-3 p-1.5 rounded-full bg-white/90 backdrop-blur-sm text-slate-600 hover:text-red-500 hover:bg-white transition-colors shadow-sm" aria-label="Favorite">
          <Heart className="size-4 sm:size-5" />
        </button>

        {/* Promo Badges */}
        <div className="absolute top-3 left-0 flex flex-col gap-1.5">
          {freeDeliveryEnabled && (
            <div className="bg-[var(--m3-primary)] text-[var(--m3-on-primary)] px-3 py-1 text-[11px] sm:text-xs font-bold rounded-r-full shadow-md w-fit">
              {t('Free Delivery', 'توصيل مجاني')}
            </div>
          )}
          {hasActiveDeal && (
            <div className="bg-emerald-500 text-white px-3 py-1 text-[11px] sm:text-xs font-bold rounded-r-full shadow-md w-fit">
              {t('Special Offer', 'عرض خاص')}
            </div>
          )}
        </div>
      </div>

      {/* Content Details */}
      <div className="flex flex-col px-1">
        <div className="flex items-start justify-between gap-2">
          {titleTag === 'h2' ? (
            <h2 className="text-[16px] sm:text-[18px] font-bold text-slate-900 tracking-tight truncate" dir={dir}>
              {displayName}
            </h2>
          ) : (
            <h3 className="text-[16px] sm:text-[18px] font-bold text-slate-900 tracking-tight truncate" dir={dir}>
              {displayName}
            </h3>
          )}
          {rating && rating.totalCount > 0 && (
            <div className="shrink-0 pt-0.5">
              <EntityRatingBadge averageScore={rating.averageScore} totalCount={rating.totalCount} size="sm" />
            </div>
          )}
        </div>

        <div className="mt-0.5 flex flex-col gap-0.5 text-[13px] text-slate-600" dir={dir}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="max-w-[120px] truncate">{typeLabel}</span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <Clock className="size-3 shrink-0" />
              <span className="leading-snug">{estimationLine}</span>
            </span>
          </div>
          {breakdown && (
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{breakdown}</span>
          )}
        </div>

        <div className="mt-1 text-[13px] font-medium text-slate-500" dir={dir}>
          <span className={freeDeliveryEnabled ? 'text-emerald-600 font-semibold' : ''}>{deliveryFee}</span>
        </div>
      </div>
    </div>
  )

  const combinedClass = cn('block w-full outline-none', className)

  if (useFullPageLink) {
    return (
      <FullPageLink href={href} className={combinedClass}>
        {inner}
      </FullPageLink>
    )
  }
  return (
    <Link href={href} className={combinedClass}>
      {inner}
    </Link>
  )
}

/** Compact adaptive logo tile for search dropdown rows */
export function BusinessSearchRowLogo({ logoUrl, alt }: { logoUrl: string | null; alt: string }) {
  return (
    <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {logoUrl ? (
        <Image src={logoUrl} alt={alt} fill className="object-contain object-center p-1" sizes="48px" />
      ) : (
        <div className="relative flex h-full w-full items-center justify-center">
          <Store className="size-6 text-slate-400" />
        </div>
      )}
    </div>
  )
}
