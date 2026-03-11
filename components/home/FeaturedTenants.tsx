'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'motion/react'
import { Store, UtensilsCrossed, Flame, ChevronRight } from 'lucide-react'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'
import { BUSINESS_TYPES } from '@/lib/constants'

type Localized = { en: string; ar: string }

type Tenant = {
  _id: string
  name: string
  name_en?: string | null
  name_ar?: string | null
  slug: string
  businessType: string
  logoUrl: string | null
  sections: Localized[]
  popularItems: Localized[]
}

type FeaturedTenantsProps = {
  category: string
}

export function FeaturedTenants({ category }: FeaturedTenantsProps) {
  const { lang, t } = useLanguage()
  const { city, isChosen } = useLocation()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isChosen || !city || !category) {
      setTenants([])
      setLoading(false)
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ city, category })
    
    fetch(`/api/home/tenants?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setTenants(Array.isArray(data?.tenants) ? data.tenants : [])
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [isChosen, city, category])

  if (!isChosen || (loading && tenants.length === 0)) {
    return (
      <section className="pt-2 pb-8">
        <h2 className="mb-6 text-xl font-bold text-slate-900 md:text-2xl tracking-tight">
          {t('Featured places', 'أماكن مميزة')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-[104px] animate-pulse rounded-[20px] bg-slate-200/60"
            />
          ))}
        </div>
      </section>
    )
  }

  if (tenants.length === 0) {
    return (
      <section className="pt-2 pb-8">
        <div className="rounded-3xl border border-slate-100 bg-white p-12 text-center shadow-sm">
          <Store className="mx-auto size-16 text-slate-200" />
          <p className="mt-4 text-slate-600 font-medium text-lg">
            {t('No businesses found here yet.', 'لا توجد أعمال هنا بعد.')}
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="pt-2 pb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900 md:text-2xl tracking-tight">
          {t('Featured places to order', 'أماكن مميزة للطلب')}
        </h2>
        <Link href={`/search?category=${category}`} className="text-sm font-semibold text-brand-yellow hover:text-brand-yellow/80 hidden sm:block">
          {t('See All', 'عرض الكل')}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {tenants.slice(0, 9).map((tStore, i) => (
          <motion.div
            key={tStore._id}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: Math.min(i * 0.04, 0.4) }}
          >
            <Link
              href={tStore.slug ? `/t/${tStore.slug}` : '#'}
              className="group flex items-center gap-4 overflow-hidden rounded-[20px] bg-white p-4 transition-all duration-300 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] border border-transparent hover:border-brand-yellow/30"
            >
              {/* Logo - Circular elevated avatar M3 */}
              <div className="relative size-[72px] shrink-0 overflow-hidden rounded-full bg-slate-50 shadow-sm border border-slate-100/60 group-hover:scale-[1.03] transition-transform duration-300">
                {tStore.logoUrl ? (
                  <Image
                    src={tStore.logoUrl}
                    alt={(lang === 'ar' ? tStore.name_ar : tStore.name_en) || tStore.name}
                    fill
                    className="object-contain p-2"
                    sizes="72px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Store className="size-8 text-slate-300" />
                  </div>
                )}
              </div>
              
              {/* Details - Right stack */}
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <h2 className="font-bold text-slate-900 text-[17px] tracking-tight truncate group-hover:text-brand-yellow transition-colors">
                  {(lang === 'ar' ? tStore.name_ar : tStore.name_en) || tStore.name}
                </h2>
                
                <div className="flex items-center gap-1.5 mt-0.5 text-[13px] text-slate-500 capitalize font-medium">
                  {lang === 'ar'
                    ? BUSINESS_TYPES.find((b) => b.value === tStore.businessType)?.labelAr ??
                      tStore.businessType
                    : BUSINESS_TYPES.find((b) => b.value === tStore.businessType)?.label ??
                      tStore.businessType}
                </div>

                {tStore.sections.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-[13px] text-slate-500">
                    <UtensilsCrossed className="size-3.5 shrink-0 text-slate-400" />
                    <span className="line-clamp-1">
                      {tStore.sections
                        .map((s) => (lang === 'ar' ? s.ar || s.en : s.en || s.ar))
                        .filter(Boolean)
                        .join(' • ')}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 flex justify-center sm:hidden">
         <Link href={`/search?category=${category}`} className="w-full flex items-center justify-center h-12 rounded-full border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 transition">
            {t('See all stores', 'عرض جميع المتاجر')}
         </Link>
      </div>
    </section>
  )
}
