'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Store } from 'lucide-react'
import { FullPageLink } from '@/components/ui/FullPageLink'
import { FreeDeliveryLogoFrame } from '@/components/home/FreeDeliveryLogoFrame'
import { FreeDeliveryCardBadge } from '@/components/home/FreeDeliveryCardBadge'
import { useAdaptiveLogoBackground } from '@/components/home/useAdaptiveLogoBackground'
import { BUSINESS_TYPES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { BUSINESS_LISTING_CARD_GRID_CLASS } from '@/lib/ui/businessListingGrid'

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
  /** Search / sheet overlays: full page navigation avoids Link + portal issues */
  useFullPageLink?: boolean
  titleTag?: 'h2' | 'h3'
  className?: string
  dir?: 'ltr' | 'rtl'
  rating?: { averageScore: number; totalCount: number } | null
}

const CARD_SURFACE_CLASS =
  'group flex w-full flex-col items-center rounded-[20px] border border-slate-200 bg-white p-5 pb-5 shadow-sm transition-all duration-300 hover:border-amber-300/70 hover:bg-slate-50/90 hover:shadow-md'

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
}: BusinessListingCardProps) {
  const { containerRef, backgroundColor } = useAdaptiveLogoBackground(logoUrl)
  const typeLabel =
    lang === 'ar'
      ? BUSINESS_TYPES.find((b) => b.value === businessType)?.labelAr ?? businessType
      : BUSINESS_TYPES.find((b) => b.value === businessType)?.label ?? businessType

  const titleClass =
    'mt-2 w-full text-center text-[17px] font-bold tracking-tight text-slate-900 line-clamp-2 transition-colors group-hover:text-amber-700 sm:mt-3 sm:text-[19px]'

  const inner = (
    <>
      <div ref={containerRef} className="relative shrink-0">
        <FreeDeliveryLogoFrame
          active={freeDeliveryEnabled === true}
          variant="light"
          ariaLabel={t('Free Delivery', 'توصيل مجاني')}
          style={backgroundColor ? { backgroundColor } : undefined}
          className={cn(
            'size-[160px] rounded-3xl border border-slate-200 transition-[transform,background-color] duration-500 ease-out sm:size-[176px] group-hover:scale-[1.03]',
            !backgroundColor && 'bg-white'
          )}
        >
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={displayName}
              fill
              className="object-contain p-3 sm:p-4"
              sizes="(max-width: 639px) 160px, 176px"
            />
          ) : (
            <div className="relative flex h-full w-full items-center justify-center">
              <Store className="size-[52px] text-slate-400 sm:size-14" />
            </div>
          )}
        </FreeDeliveryLogoFrame>
        {freeDeliveryEnabled && (
          <FreeDeliveryCardBadge label={t('Free Delivery', 'توصيل مجاني')} variant="light" />
        )}
      </div>

      {titleTag === 'h2' ? (
        <h2 className={titleClass} dir={dir}>
          {displayName}
        </h2>
      ) : (
        <h3 className={titleClass} dir={dir}>
          {displayName}
        </h3>
      )}

      <p className="mt-1 text-[13px] font-medium capitalize text-slate-600 flex items-center justify-center gap-2" dir={dir}>
        {typeLabel}
        {rating && rating.totalCount > 0 && (
          <>
            <span className="text-slate-300">•</span>
            <EntityRatingBadge averageScore={rating.averageScore} totalCount={rating.totalCount} size="sm" />
          </>
        )}
      </p>

      {sections && sections.length > 0 && (
        <p className="mt-1 line-clamp-2 text-center text-[12px] text-slate-500" dir={dir}>
          {sections
            .map((s) => (lang === 'ar' ? s.ar || s.en : s.en || s.ar))
            .filter(Boolean)
            .join(' • ')}
        </p>
      )}
    </>
  )

  const combinedClass = cn(
    CARD_SURFACE_CLASS,
    freeDeliveryEnabled ? 'overflow-visible' : 'overflow-hidden',
    className
  )

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

/** Compact adaptive logo tile for search dropdown rows (matches card sampling logic). */
export function BusinessSearchRowLogo({ logoUrl, alt }: { logoUrl: string | null; alt: string }) {
  const { containerRef, backgroundColor } = useAdaptiveLogoBackground(logoUrl)
  return (
    <div ref={containerRef} className="relative size-12 shrink-0">
      <FreeDeliveryLogoFrame
        active={false}
        variant="light"
        ariaLabel={alt}
        style={backgroundColor ? { backgroundColor } : undefined}
        className={cn(
          'size-12 overflow-hidden rounded-xl border border-slate-200',
          !backgroundColor && 'bg-white'
        )}
      >
        {logoUrl ? (
          <Image src={logoUrl} alt={alt} fill className="object-contain p-1" sizes="48px" />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center">
            <Store className="size-6 text-slate-400" />
          </div>
        )}
      </FreeDeliveryLogoFrame>
    </div>
  )
}
