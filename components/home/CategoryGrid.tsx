'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
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

export function CategoryGrid() {
  const { t, lang } = useLanguage()
  const { city, isChosen } = useLocation()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isChosen || !city) {
      const resetId = requestAnimationFrame(() => {
        setCategories([])
        setLoading(false)
      })
      return () => cancelAnimationFrame(resetId)
    }
    const ac = new AbortController()
    const loadId = requestAnimationFrame(() => setLoading(true))
    const params = new URLSearchParams({ city })
    fetch(`/api/home/categories?${params}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!ac.signal.aborted) setCategories(Array.isArray(data) ? data : [])
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })
    return () => {
      cancelAnimationFrame(loadId)
      ac.abort()
    }
  }, [isChosen, city])

  if (!isChosen) return null
  if (loading) {
    return (
      <section className="py-8">
        <h2 className="mb-6 text-xl font-bold text-slate-900">
          {t('Categories', 'التصنيفات')}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-2xl bg-slate-200"
            />
          ))}
        </div>
      </section>
    )
  }
  if (categories.length === 0) return null

  return (
    <section className="py-8">
      <h2 className="mb-6 text-xl font-bold text-slate-900 md:text-2xl tracking-tight">
        {t('Browse by category', 'تصفح حسب التصنيف')}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {categories.map((cat, i) => (
          <motion.div
            key={cat._id}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.2, 0, 0, 1], delay: i * 0.05 }}
          >
            <Link
              href={`/search?category=${encodeURIComponent(cat.value)}`}
              className="group flex flex-col overflow-hidden rounded-[20px] bg-white transition-all duration-300 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] border border-slate-100 hover:border-emerald-100"
            >
              <div className="relative aspect-square overflow-hidden bg-slate-50">
                {cat.imageUrl ? (
                  <Image
                    src={cat.imageUrl}
                    alt={lang === 'ar' ? cat.name_ar : cat.name_en}
                    fill
                    className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)] group-hover:scale-[1.05]"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  />
                ) : (
                  <div className="h-full w-full bg-slate-100" />
                )}
                {/* Subtle gradient overlay for premium feel */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>
              <div className="p-3.5 text-center flex flex-col items-center justify-center bg-white z-10 relative">
                <span className="font-bold text-[15px] sm:text-base text-slate-900 group-hover:text-emerald-700 transition-colors">
                  {lang === 'ar' ? cat.name_ar : cat.name_en}
                </span>
                {cat.tenantCount > 0 && (
                  <span className="mt-0.5 block text-[13px] font-medium text-slate-500">
                    {t('{count} places', '{count} أماكن').replace(
                      '{count}',
                      String(cat.tenantCount)
                    )}
                  </span>
                )}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
