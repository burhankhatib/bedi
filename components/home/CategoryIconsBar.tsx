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
                className="group flex flex-col items-center gap-2 w-16 sm:w-20 cursor-pointer outline-none"
              >
                <div
                  className={`flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-all duration-300 ease-in-out cursor-pointer
                    ${isActive
                      ? 'bg-emerald-100 text-emerald-600 shadow-md ring-2 ring-emerald-500 ring-offset-2'
                      : 'bg-white text-slate-600 shadow-sm border border-slate-200 group-hover:bg-emerald-50 group-hover:text-emerald-500 group-hover:border-emerald-200 group-hover:shadow-md'
                    }
                  `}
                >
                  <motion.div
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
                  </motion.div>
                </div>
                <span
                  className={`text-xs sm:text-sm font-medium text-center transition-colors
                    ${isActive ? 'text-emerald-700 font-bold' : 'text-slate-600 group-hover:text-emerald-600'}
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
