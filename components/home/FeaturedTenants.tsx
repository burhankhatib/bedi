'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { Store } from 'lucide-react'
import { BusinessListingCard } from '@/components/home/BusinessListingCard'
import { BUSINESS_LISTING_CARD_GRID_CLASS } from '@/lib/ui/businessListingGrid'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'

type Localized = { en: string; ar: string }

type Tenant = {
  _id: string
  name: string
  name_en?: string | null
  name_ar?: string | null
  slug: string
  businessType: string
  freeDeliveryEnabled?: boolean
  logoUrl: string | null
  sections: Localized[]
  popularItems: Localized[]
  rating?: { averageScore: number; totalCount: number } | null
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
    const controller = new AbortController()

    fetch(`/api/home/tenants?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setTenants(Array.isArray(data?.tenants) ? data.tenants : [])
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error(err)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [isChosen, city, category])

  if (!isChosen || (loading && tenants.length === 0)) {
    return (
      <section className="p-10 my-10">
        <h2 className="mb-6 text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
          {t('Featured places', 'أماكن مميزة')}
        </h2>
        <div className={BUSINESS_LISTING_CARD_GRID_CLASS}>
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-[300px] animate-pulse rounded-[20px] bg-slate-100"
            />
          ))}
        </div>
      </section>
    )
  }

  if (tenants.length === 0) {
    return (
      <section className="pt-2 pb-8">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-12 text-center">
          <Store className="mx-auto size-16 text-slate-400" />
          <p className="mt-4 text-lg font-medium text-slate-600">
            {t('No businesses found here yet.', 'لا توجد أعمال هنا بعد.')}
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="pt-2 pb-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
          {t('Featured places to order', 'أماكن مميزة للطلب')}
        </h2>
        <Link
          href={`/search?category=${category}`}
          className="hidden text-sm font-semibold text-amber-600 transition-colors hover:text-amber-700 sm:block"
        >
          {t('See All', 'عرض الكل')}
        </Link>
      </div>

      <div className={BUSINESS_LISTING_CARD_GRID_CLASS}>
        {tenants.slice(0, 12).map((tStore, i) => (
          <motion.div
            key={tStore._id}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: Math.min(i * 0.04, 0.4) }}
          >
            <BusinessListingCard
              href={tStore.slug ? `/t/${tStore.slug}` : '#'}
              logoUrl={tStore.logoUrl}
              displayName={(lang === 'ar' ? tStore.name_ar : tStore.name_en) || tStore.name}
              businessType={tStore.businessType}
              freeDeliveryEnabled={tStore.freeDeliveryEnabled}
              sections={tStore.sections}
              rating={tStore.rating}
              lang={lang}
              t={t}
              titleTag="h2"
            />
          </motion.div>
        ))}
      </div>

      <div className="mt-6 flex justify-center sm:hidden">
        <Link
          href={`/search?category=${category}`}
          className="flex h-12 w-full items-center justify-center rounded-full border border-slate-300 font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
        >
          {t('See all stores', 'عرض جميع المتاجر')}
        </Link>
      </div>
    </section>
  )
}
