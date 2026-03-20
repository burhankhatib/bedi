'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'motion/react'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'
import { UtensilsCrossed } from 'lucide-react'
import { LucideKebabIcon } from '@/components/icons/LucideKebabIcon'

type SubcategoryItem = {
  _id: string
  slug: string
  title_en: string
  title_ar: string
  tenantCount: number
  imageUrl: string | null
  lucideIcon?: string | null
}

export function SubcategoriesSection() {
  const { city, isChosen } = useLocation()
  const { t, lang } = useLanguage()
  const [subcategories, setSubcategories] = useState<SubcategoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isChosen || !city) {
      const resetId = requestAnimationFrame(() => {
        setSubcategories([])
        setLoading(false)
      })
      return () => cancelAnimationFrame(resetId)
    }
    const ac = new AbortController()
    const loadId = requestAnimationFrame(() => setLoading(true))
    const params = new URLSearchParams({ city, category: 'restaurant' })
    fetch(`/api/home/subcategories?${params}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!ac.signal.aborted) setSubcategories(Array.isArray(data) ? data : [])
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
      <section className="py-12">
        <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-900 md:text-2xl">
          <UtensilsCrossed className="size-6 text-emerald-600" />
          {t('Browse by specialty', 'تصفح حسب التخصص')}
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
  if (subcategories.length === 0) return null

  return (
    <section className="py-12">
      <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-900 md:text-2xl">
        <UtensilsCrossed className="size-6 text-emerald-600" />
        {t('Browse by specialty', 'تصفح حسب التخصص')}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {subcategories.map((s, i) => (
          <motion.div
            key={s._id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
          >
            <Link
              href={`/search?subcategory=${encodeURIComponent(s._id)}&category=restaurant`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-300 hover:shadow-md"
            >
              <div className="relative aspect-square overflow-hidden bg-slate-100">
                {s.imageUrl ? (
                  <Image
                    src={s.imageUrl}
                    alt={lang === 'ar' ? s.title_ar : s.title_en}
                    fill
                    className="object-cover transition group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                    <LucideKebabIcon
                      name={s.lucideIcon}
                      className="size-14 text-emerald-600/90"
                      size={56}
                      strokeWidth={1.25}
                    />
                  </div>
                )}
              </div>
              <div className="p-3 text-center">
                <span className="font-semibold text-slate-900 group-hover:text-emerald-600">
                  {lang === 'ar' ? s.title_ar : s.title_en}
                </span>
                {s.tenantCount > 0 && (
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {t('{count} places', '{count} أماكن').replace(
                      '{count}',
                      String(s.tenantCount)
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
