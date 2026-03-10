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
        <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-900 md:text-2xl tracking-tight">
          <Flame className="size-6 text-amber-500" />
          {t('Popular dishes', 'أطباق شائعة')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] animate-pulse rounded-[20px] bg-slate-200/60"
            />
          ))}
        </div>
      </section>
    )
  }
  if (products.length === 0) return null

  return (
    <section className="py-12">
      <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-900 md:text-2xl tracking-tight">
        <Flame className="size-6 text-amber-500" />
        {t('Popular items from businesses', 'أصناف شائعة من الأعمال')}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pt-2">
        {products.map((item, i) => (
          <motion.div
            key={item._id}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.2, 0, 0, 1], delay: Math.min(i * 0.05, 0.4) }}
          >
            <Link
              href={item.restaurant.slug ? `/t/${item.restaurant.slug}` : '#'}
              className="group flex flex-col overflow-hidden rounded-[20px] bg-white transition-all duration-300 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] border border-transparent hover:border-emerald-100"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-50">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={lang === 'ar' ? item.title_ar : item.title_en}
                    fill
                    className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)] group-hover:scale-[1.05]"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-100">
                    <Flame className="size-16 text-slate-300" />
                  </div>
                )}
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>
              <div className="flex flex-col gap-2 p-4 bg-white z-10">
                <h3 className="font-bold text-slate-900 text-[17px] tracking-tight line-clamp-1 group-hover:text-emerald-700 transition-colors">
                  {lang === 'ar' ? item.title_ar || item.title_en : item.title_en || item.title_ar}
                </h3>
                <div className="flex items-center gap-2.5 mt-1 text-slate-500 font-medium">
                  <div className="relative size-[26px] shrink-0 overflow-hidden rounded-full bg-slate-50 border border-slate-100/60 shadow-sm">
                    {item.restaurant.logoUrl ? (
                      <Image
                        src={item.restaurant.logoUrl}
                        alt={item.restaurant.name}
                        fill
                        className="object-contain p-0.5"
                        sizes="26px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Store className="size-3.5 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <span className="truncate text-[13px] text-slate-500">
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
