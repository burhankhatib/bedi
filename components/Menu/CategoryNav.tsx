'use client'

import { Category } from '@/app/types/menu'
import { useLanguage } from '@/components/LanguageContext'
import { cn } from '@/lib/utils'
import { useEffect, useState, forwardRef } from 'react'
import { Star } from 'lucide-react'

interface CategoryNavProps {
  categories: Category[]
  activeCategory: string | null
  onCategoryClick: (id: string) => void
  topOffset?: number
  showMostPopular?: boolean
  /** When true, nav is not sticky (parent handles stickiness). Used when inside sticky menu bar. */
  embedded?: boolean
}

const MOST_POPULAR_ID = 'most-popular'

export const CategoryNav = forwardRef<HTMLElement, CategoryNavProps>(
  ({ categories, activeCategory, onCategoryClick, topOffset = 88, showMostPopular = false, embedded = false }, ref) => {
    const { t } = useLanguage()

    return (
      <nav
        ref={ref}
        className={cn(
          'flex gap-2 min-w-max py-2',
          !embedded && 'sticky z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 overflow-x-auto no-scrollbar shadow-sm px-4 py-3'
        )}
        style={!embedded ? { top: `${topOffset}px` } : undefined}
      >
        <div className={cn('flex gap-2 min-w-max', embedded && 'px-1')}>
          {showMostPopular && (
            <button
              onClick={() => onCategoryClick(MOST_POPULAR_ID)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5",
                activeCategory === MOST_POPULAR_ID
                  ? "bg-black text-white shadow-md scale-105"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <Star className="w-4 h-4 shrink-0" />
              {t('Most Popular', 'الأكثر طلباً')}
            </button>
          )}
          {categories.map((category) => (
            <button
              key={category._id}
              onClick={() => onCategoryClick(category._id)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                activeCategory === category._id
                  ? "bg-black text-white shadow-md scale-105"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {t(category.title_en, category.title_ar)}
            </button>
          ))}
        </div>
      </nav>
    )
  }
)

CategoryNav.displayName = 'CategoryNav'
