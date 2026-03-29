'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { FullPageLink } from '@/components/ui/FullPageLink'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'
import { getSectionEmoji } from '@/lib/section-icons'
import { cn } from '@/lib/utils'

type SubcategoryItem = {
  _id: string
  slug: string
  title_en: string
  title_ar: string
  tenantCount: number
  imageUrl: string | null
}

type CategoryIconsBarProps = {
  /** When used on search page, highlight the active subcategory (ID). */
  activeSubcategoryId?: string
  /** Optional: restrict to this business type (default: restaurant). */
  category?: string
  className?: string
  /**
   * Homepage: fixed leading column with M3 back control; category chips scroll horizontally beside it.
   */
  stickyBack?: {
    onClick: () => void
    ariaLabel: string
  }
}

function M3StickyBackButton({
  onClick,
  ariaLabel,
  isRtl,
}: {
  onClick: () => void
  ariaLabel: string
  isRtl: boolean
}) {
  const NavIcon = isRtl ? ArrowRight : ArrowLeft
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-full',
        'bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]',
        'shadow-[var(--m3-elevation-2)] ring-1 ring-[var(--m3-outline-variant)]/60',
        'transition-[transform,box-shadow] duration-[var(--m3-duration-short)] ease-[var(--m3-ease-standard)]',
        'hover:shadow-[var(--m3-elevation-3)] active:scale-[0.96]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--m3-primary)]'
      )}
    >
      <NavIcon className="size-6 stroke-[2.25]" aria-hidden />
    </button>
  )
}

export function CategoryIconsBar({
  activeSubcategoryId,
  category = 'restaurant',
  className = '',
  stickyBack,
}: CategoryIconsBarProps) {
  const { lang } = useLanguage()
  const isRtl = lang === 'ar'
  const { city, isChosen } = useLocation()
  const [subcategories, setSubcategories] = useState<SubcategoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isChosen || !city) {
      setSubcategories([])
      setLoading(false)
      return
    }
    let mounted = true
    setLoading(true)
    const params = new URLSearchParams({ city, category: category || 'restaurant' })
    const ac = new AbortController()
    fetch(`/api/home/subcategories?${params}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => { if (mounted) setSubcategories(Array.isArray(data) ? data : []) })
      .catch((err) => { if (mounted && err?.name !== 'AbortError') setSubcategories([]) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false; ac.abort() }
  }, [isChosen, city, category])

  const chipGap = 'gap-4 sm:gap-6 md:gap-8'
  const stickyRail = stickyBack ? (
    <div
      className={cn(
        'relative z-10 flex shrink-0 flex-col items-center bg-slate-50/95 backdrop-blur-sm justify-center',
        'border-[var(--m3-outline-variant)] shadow-[4px_0_12px_-6px_rgba(0,0,0,0.08)]',
        isRtl ? 'border-s ps-3 pe-4 sm:pe-6' : 'border-e ps-4 pe-3 sm:ps-6'
      )}
    >
      <M3StickyBackButton onClick={stickyBack.onClick} ariaLabel={stickyBack.ariaLabel} isRtl={isRtl} />
    </div>
  ) : null

  if (!isChosen || (loading && subcategories.length === 0)) {
    if (stickyBack) {
      return (
        <div className={cn('flex w-full items-stretch h-[120px]', className)}>
          {stickyRail}
          <div className={cn('flex min-w-0 flex-1 justify-start overflow-x-auto py-3 items-center no-scrollbar', chipGap, 'px-2 pe-4 sm:pe-6')}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex min-w-[70px] flex-shrink-0 flex-col items-center gap-2">
                <div className="h-14 w-14 animate-pulse rounded-full bg-slate-200 sm:h-16 sm:w-16" />
                <div className="h-3 w-12 animate-pulse rounded-md bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div className={`flex justify-center gap-4 overflow-x-auto px-4 py-3 items-center h-[120px] no-scrollbar sm:gap-6 md:gap-8 ${className}`}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex min-w-[70px] flex-col items-center gap-2">
            <div className="h-14 w-14 animate-pulse rounded-full bg-slate-200" />
            <div className="h-3 w-12 animate-pulse rounded-md bg-slate-200" />
          </div>
        ))}
      </div>
    )
  }

  if (subcategories.length === 0 && !stickyBack) return null

  const chips = subcategories.map((s) => {
    const emoji = getSectionEmoji(s.slug, s.title_en, s.title_ar)
    const isActive = activeSubcategoryId === s._id

    return (
      <div key={s._id} className="flex-shrink-0">
        <FullPageLink
          href={`/search?subcategory=${encodeURIComponent(s._id)}&category=${encodeURIComponent(category || 'restaurant')}`}
          className="group flex w-[72px] cursor-pointer flex-col items-center gap-1.5 outline-none sm:w-[84px]"
        >
          <div
            className={`relative flex h-[64px] w-[64px] items-center justify-center rounded-[20px] transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] sm:h-[72px] sm:w-[72px] ${
              isActive
                ? 'bg-transparent ring-[3px] ring-slate-800'
                : 'bg-transparent text-slate-500 hover:bg-slate-100/50'
            }`}
          >
            <span className="text-[32px] transition-transform duration-300 group-hover:scale-110 sm:text-4xl">
              {emoji}
            </span>
          </div>
          <span
            className={`line-clamp-2 px-1 text-center text-[12px] font-semibold leading-tight transition-colors sm:text-[13px] ${
              isActive ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-900'
            }`}
          >
            {lang === 'ar' ? s.title_ar : s.title_en}
          </span>
        </FullPageLink>
      </div>
    )
  })

  if (stickyBack) {
    return (
      <div className={cn('flex w-full items-stretch h-[120px]', className)}>
        {stickyRail}
        <div
          className={cn(
            'flex min-w-0 flex-1 items-center justify-start overflow-x-auto py-3 no-scrollbar',
            chipGap,
            'px-2 pe-4 sm:pe-6'
          )}
        >
          {subcategories.length === 0 ? (
            <p className="py-3 text-sm text-[var(--m3-on-surface-variant)]">
              {lang === 'ar' ? 'لا توجد تصنيفات في مدينتك بعد.' : 'No categories in your city yet.'}
            </p>
          ) : (
            chips
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full h-[120px] py-3 flex items-center ${className}`}>
      <div className={`flex justify-start gap-4 overflow-x-auto px-4 no-scrollbar sm:gap-6 md:gap-8`}>{chips}</div>
    </div>
  )
}
