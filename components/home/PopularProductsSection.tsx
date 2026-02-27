'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'motion/react'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'
import { Flame, Store } from 'lucide-react'

type PopularProduct = {
  _id: string
  title_en: string
  title_ar: string
  imageUrl: string | null
  restaurant: {
    _id: string
    name: string
    slug: string
    logoUrl: string | null
  }
}

export function PopularProductsSection() {
  const { city, isChosen } = useLocation()
  const { t, lang } = useLanguage()
  const [products, setProducts] = useState<PopularProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isChosen || !city) {
      setProducts([])
      setLoading(false)
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ city })
    fetch(`/api/home/popular-products?${params}`)
      .then((res) => res.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [isChosen, city])

  if (!isChosen) return null
  if (loading) {
    return (
      <section className="py-12">
        <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-900 md:text-2xl">
          <Flame className="size-6 text-amber-500" />
          {t('Popular dishes', 'أطباق شائعة')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] animate-pulse rounded-2xl bg-slate-200"
            />
          ))}
        </div>
      </section>
    )
  }
  if (products.length === 0) return null

  return (
    <section className="py-12">
      <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-900 md:text-2xl">
        <Flame className="size-6 text-amber-500" />
        {t('Popular items from businesses', 'أصناف شائعة من الأعمال')}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((item, i) => (
          <motion.div
            key={item._id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
          >
            <Link
              href={item.restaurant.slug ? `/t/${item.restaurant.slug}` : '#'}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/5"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={lang === 'ar' ? item.title_ar : item.title_en}
                    fill
                    className="object-cover transition group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-100">
                    <Flame className="size-16 text-slate-300" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 p-4">
                <h3 className="font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-700">
                  {lang === 'ar' ? item.title_ar || item.title_en : item.title_en || item.title_ar}
                </h3>
                <div className="flex items-center gap-2">
                  <div className="relative size-8 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {item.restaurant.logoUrl ? (
                      <Image
                        src={item.restaurant.logoUrl}
                        alt={item.restaurant.name}
                        fill
                        className="object-contain p-0.5"
                        sizes="32px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Store className="size-4 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <span className="truncate text-sm font-medium text-slate-600">
                    {item.restaurant.name}
                  </span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
