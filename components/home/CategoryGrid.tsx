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
      setCategories([])
      setLoading(false)
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ city })
    fetch(`/api/home/categories?${params}`)
      .then((res) => res.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
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
      <h2 className="mb-6 text-xl font-bold text-slate-900 md:text-2xl">
        {t('Browse by category', 'تصفح حسب التصنيف')}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {categories.map((cat, i) => (
          <motion.div
            key={cat._id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Link
              href={`/search?category=${encodeURIComponent(cat.value)}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-300 hover:shadow-md"
            >
              <div className="relative aspect-square overflow-hidden bg-slate-100">
                {cat.imageUrl ? (
                  <Image
                    src={cat.imageUrl}
                    alt={lang === 'ar' ? cat.name_ar : cat.name_en}
                    fill
                    className="object-cover transition group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  />
                ) : (
                  <div className="h-full w-full bg-slate-200" />
                )}
              </div>
              <div className="p-3 text-center">
                <span className="font-semibold text-slate-900 group-hover:text-emerald-600">
                  {lang === 'ar' ? cat.name_ar : cat.name_en}
                </span>
                {cat.tenantCount > 0 && (
                  <span className="mt-0.5 block text-xs text-slate-500">
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
