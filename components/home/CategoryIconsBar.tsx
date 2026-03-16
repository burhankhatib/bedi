'use client'

import { useState, useEffect } from 'react'
import { FullPageLink } from '@/components/ui/FullPageLink'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'
import { getSectionIcon } from '@/lib/section-icons'

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
}

export function CategoryIconsBar({ activeSubcategoryId, category = 'restaurant', className = '' }: CategoryIconsBarProps) {
  const { lang } = useLanguage()
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

  if (!isChosen || (loading && subcategories.length === 0)) {
    return (
      <div className={`py-6 flex justify-center gap-4 sm:gap-6 md:gap-8 overflow-x-auto no-scrollbar px-4 ${className}`}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 min-w-[70px]">
            <div className="w-14 h-14 rounded-full bg-slate-200 animate-pulse" />
            <div className="w-12 h-3 rounded-md bg-slate-200 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (subcategories.length === 0) return null

  return (
    <div className={`py-6 w-full ${className}`}>
      <div className="flex justify-start gap-4 sm:gap-6 md:gap-8 overflow-x-auto no-scrollbar px-4 pb-4">
        {subcategories.map((s) => {
          const Icon = getSectionIcon(s.slug)
          const isActive = activeSubcategoryId === s._id

          return (
            <div key={s._id} className="flex-shrink-0">
              <FullPageLink
                href={`/search?subcategory=${encodeURIComponent(s._id)}&category=${encodeURIComponent(category || 'restaurant')}`}
                className="group flex flex-col items-center gap-2.5 w-16 sm:w-[84px] cursor-pointer outline-none"
              >
                <div
                  className={`relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] shadow-sm
                    ${isActive
                      ? 'bg-brand-yellow text-brand-black ring-2 ring-brand-yellow/30 ring-offset-2'
                      : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 border border-slate-100'
                    }
                  `}
                >
                  <Icon className="w-6 h-6 sm:w-7 sm:h-7 transition-transform duration-300 group-hover:scale-110" />
                </div>
                <span
                  className={`text-[11px] sm:text-[13px] font-medium text-center transition-colors line-clamp-2 leading-tight px-1
                    ${isActive ? 'text-brand-black font-bold' : 'text-slate-600 group-hover:text-brand-black'}
                  `}
                >
                  {lang === 'ar' ? s.title_ar : s.title_en}
                </span>
              </FullPageLink>
            </div>
          )
        })}
      </div>
    </div>
  )
}
