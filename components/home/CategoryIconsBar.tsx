'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'
import { getSectionIcon } from '@/lib/section-icons'

type Section = {
  key: string
  title_en: string
  title_ar: string
  tenantCount: number
  imageUrl: string | null
}

type CategoryIconsBarProps = {
  /** When used on search page, highlight the active specialty (section key). */
  activeSection?: string
  /** Optional: restrict sections to this business type (default: restaurant). */
  category?: string
  className?: string
}

export function CategoryIconsBar({ activeSection, category = 'restaurant', className = '' }: CategoryIconsBarProps) {
  const { lang } = useLanguage()
  const { city, isChosen } = useLocation()
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isChosen || !city) {
      setSections([])
      setLoading(false)
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ city, category })
    fetch(`/api/home/sections?${params}`)
      .then((res) => res.json())
      .then((data) => setSections(Array.isArray(data) ? data : []))
      .catch(() => setSections([]))
      .finally(() => setLoading(false))
  }, [isChosen, city, category])

  if (!isChosen || (loading && sections.length === 0)) {
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

  if (sections.length === 0) return null

  return (
    <div className={`py-6 w-full ${className}`}>
      <div className="flex justify-start md:justify-center gap-4 sm:gap-6 md:gap-8 overflow-x-auto no-scrollbar px-4 pb-4">
        {sections.map((s, i) => {
          const Icon = getSectionIcon(s.key)
          const isActive = activeSection === s.key

          return (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="flex-shrink-0"
            >
              <Link
                href={`/search?section=${encodeURIComponent(s.key)}&category=${encodeURIComponent(category)}`}
                className="group flex flex-col items-center gap-2.5 w-16 sm:w-[84px] cursor-pointer outline-none"
              >
                <div
                  className={`relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] shadow-sm
                    ${isActive
                      ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200/80 ring-offset-2'
                      : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 border border-slate-100'
                    }
                  `}
                >
                  <Icon className="w-6 h-6 sm:w-7 sm:h-7 transition-transform duration-300 group-hover:scale-110" />
                </div>
                <span
                  className={`text-[11px] sm:text-[13px] font-medium text-center transition-colors line-clamp-2 leading-tight px-1
                    ${isActive ? 'text-emerald-800 font-bold' : 'text-slate-600 group-hover:text-slate-900'}
                  `}
                >
                  {lang === 'ar' ? s.title_ar : s.title_en}
                </span>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
