'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Store } from 'lucide-react'
import { motion } from 'motion/react'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'

type Category = {
  _id: string
  value: string
  name_en: string
  name_ar: string
  imageUrl: string | null
  tenantCount: number
}

type ExploreTypesBarProps = {
  activeCategory: string
  onChange: (category: string) => void
}

/**
 * Full-width horizontal "Explore types" (Restaurants, Stores, …).
 * Replaces the old sidebar; no profile / driver CTAs here (use header).
 */
export function ExploreTypesBar({ activeCategory, onChange }: ExploreTypesBarProps) {
  const { lang, t } = useLanguage()
  const { city, isChosen } = useLocation()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const initialCategorySet = useRef(false)
  const categoriesAbortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      categoriesAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!isChosen || !city) {
      categoriesAbortRef.current?.abort()
      setCategories([])
      setLoading(false)
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ city })
    categoriesAbortRef.current?.abort()
    const ac = new AbortController()
    categoriesAbortRef.current = ac
    fetch(`/api/home/categories?${params}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!mountedRef.current || ac.signal.aborted) return
        const list = Array.isArray(data) ? data : []
        setCategories(list)
        if (list.length > 0 && !initialCategorySet.current && activeCategory === 'restaurant') {
          const hasRestaurant = list.some((c: Category) => c.value === 'restaurant' && c.tenantCount > 0)
          if (!hasRestaurant) {
            initialCategorySet.current = true
            onChange(list[0]?.value ?? 'stores')
          }
        }
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return
        if (!mountedRef.current) return
        setCategories([])
      })
      .finally(() => {
        if (mountedRef.current && !ac.signal.aborted) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- match StoreTypeSidebar: only refetch when city changes; onChange is stable
  }, [isChosen, city])

  if (!isChosen) return null

  return (
    <section
      className="w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-sm"
      aria-label={t('Explore types', 'استكشف الأنواع')}
    >
      <div className="w-full px-4 py-3 sm:px-6">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          {t('Explore types', 'استكشف الأنواع')}
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:gap-3">
          {loading
            ? [...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-11 w-28 shrink-0 animate-pulse rounded-full bg-slate-200/70 sm:h-12 sm:w-32"
                />
              ))
            : categories.map((cat) => {
                const isActive = activeCategory === cat.value
                return (
                  <motion.button
                    key={cat.value}
                    type="button"
                    onClick={() => onChange(cat.value)}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                    className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold outline-none transition-colors sm:px-5 sm:py-3 sm:text-[15px] ${
                      isActive
                        ? 'border-brand-yellow bg-brand-yellow text-brand-black shadow-md'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {cat.imageUrl ? (
                      <span className="relative inline-block size-5 shrink-0 sm:size-6">
                        <Image
                          src={cat.imageUrl}
                          alt=""
                          fill
                          className="object-contain"
                          sizes="24px"
                        />
                      </span>
                    ) : (
                      <Store className="size-5 shrink-0 opacity-70" />
                    )}
                    <span className="whitespace-nowrap">{lang === 'ar' ? cat.name_ar : cat.name_en}</span>
                  </motion.button>
                )
              })}
        </div>
      </div>
    </section>
  )
}
