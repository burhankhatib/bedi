'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { Store, Plus } from 'lucide-react'
import Image from 'next/image'
import { BusinessListingCard } from '@/components/home/BusinessListingCard'
import { useLocation } from '@/components/LocationContext'
import { getCityCenter } from '@/lib/geofencing'
import { useLanguage } from '@/components/LanguageContext'
import type { HomePageFilters } from '@/components/home/QuickFiltersRow'

type Localized = { en: string; ar: string }

type PopularItem = {
  _id: string
  name: Localized
  price?: number
  image?: string | null
  tenantSlug: string
}

type Tenant = {
  _id: string
  name: string
  name_en?: string | null
  name_ar?: string | null
  slug: string
  businessType: string
  freeDeliveryEnabled?: boolean
  hasActiveDeal?: boolean
  computedDeliveryFee?: number | null
  etaMinutes?: number | null
  estimatedTravelMinutes?: number | null
  estimatedPrepMinutes?: number | null
  rating?: { averageScore: number; totalCount: number } | null
  logoUrl: string | null
  sections: Localized[]
  popularItems: Localized[] // The API might be returning full item objects or just names? 
  // Let's assume the API returns full objects for now, or we'll mock the UI.
}

type FeaturedTenantsProps = {
  category: string
  filters: HomePageFilters
}

export function FeaturedTenants({ category, filters }: FeaturedTenantsProps) {
  const { lang, t } = useLanguage()
  const { city, isChosen, deviceCoordinates } = useLocation()
  const feeCoords =
    deviceCoordinates ?? (city ? getCityCenter(city) : null)
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
    if (filters.deliveryFee !== 'all') params.set('deliveryFilter', filters.deliveryFee)
    if (filters.dealOnly) params.set('dealOnly', 'true')
    if (filters.minRating !== null) params.set('minRating', filters.minRating.toString())
    if (filters.fastest) params.set('fastest', 'true')
    if (feeCoords?.lat != null && feeCoords?.lng != null) {
      params.set('lat', feeCoords.lat.toString())
      params.set('lng', feeCoords.lng.toString())
    }
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
  }, [isChosen, city, category, filters, feeCoords?.lat, feeCoords?.lng])

  if (!isChosen || (loading && tenants.length === 0)) {
    return (
      <section className="mx-auto max-w-7xl py-8">
        <div className="px-4 sm:px-6">
          <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        </div>
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 no-scrollbar snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex w-[min(280px,85vw)] shrink-0 snap-start flex-col gap-3 sm:w-auto sm:shrink sm:snap-none"
            >
              <div className="h-[200px] w-full animate-pulse rounded-2xl bg-slate-200" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (tenants.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-12 text-center">
          <Store className="mx-auto size-16 text-slate-400" />
          <p className="mt-4 text-lg font-medium text-slate-600">
            {t('No businesses found here yet.', 'لا توجد أعمال هنا بعد.')}
          </p>
        </div>
      </section>
    )
  }

  // Extract all popular items with images across all tenants to mock the Popular Dishes carousel
  const allDishes = tenants.flatMap(tenant => {
    // Assuming popularItems is an array of objects if populated. 
    // For safety, we just use the tenant logo as a mock image if item has no image
    return (tenant.popularItems || []).slice(0, 3).map((item: any, idx) => ({
      _id: item._id || `${tenant._id}-dish-${idx}`,
      name: item.name || item, // Fallback if it's just strings
      price: item.price || 15 + idx * 2,
      image: item.image || tenant.logoUrl,
      tenantSlug: tenant.slug,
      tenantName: (lang === 'ar' ? tenant.name_ar : tenant.name_en) || tenant.name
    }))
  }).filter(dish => typeof dish.name === 'object' ? (dish.name.en || dish.name.ar) : dish.name)

  return (
    <section className="mx-auto max-w-7xl pt-2 pb-12 overflow-hidden">
      <div className="px-4 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            {t('Featured stores', 'متاجر مميزة')}
          </h2>
          <Link
            href={`/search?category=${category}`}
            className="hidden text-sm font-semibold text-emerald-600 transition-colors hover:text-emerald-700 sm:block"
          >
            {t('See All', 'عرض الكل')}
          </Link>
        </div>

        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 no-scrollbar snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4">
          {tenants.slice(0, 8).map((tStore, i) => (
            <motion.div
              key={tStore._id}
              className="w-[min(280px,85vw)] shrink-0 snap-start sm:w-auto sm:shrink sm:snap-none"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
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
                computedDeliveryFee={tStore.computedDeliveryFee}
                etaMinutes={tStore.etaMinutes}
                estimatedTravelMinutes={tStore.estimatedTravelMinutes}
                estimatedPrepMinutes={tStore.estimatedPrepMinutes}
                hasActiveDeal={tStore.hasActiveDeal}
              />
            </motion.div>
          ))}
        </div>

        <div className="mt-8 flex justify-center sm:hidden">
          <Link
            href={`/search?category=${category}`}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-100 font-semibold text-slate-700 transition hover:bg-slate-200 hover:text-slate-900"
          >
            {t('See all stores', 'عرض جميع المتاجر')}
          </Link>
        </div>
      </div>

      {allDishes.length > 0 && (
        <div className="mt-16 border-t border-slate-100 pt-10">
          <div className="px-4 sm:px-6 mb-6">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              {t('Popular Dishes', 'أطباق شائعة')}
            </h2>
          </div>
          
          <div className="flex overflow-x-auto gap-4 px-4 sm:px-6 pb-6 no-scrollbar snap-x">
            {allDishes.slice(0, 10).map((dish, idx) => (
              <Link 
                href={`/t/${dish.tenantSlug}`}
                key={dish._id} 
                className="group flex flex-col w-[160px] sm:w-[200px] shrink-0 snap-start outline-none"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-100 mb-3 ring-1 ring-black/5">
                  {dish.image ? (
                    <Image src={dish.image} alt="dish" fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="200px" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Store className="size-8 text-slate-300" />
                    </div>
                  )}
                  <button type="button" className="absolute bottom-2 right-2 bg-white rounded-full p-1.5 shadow-md text-slate-700 hover:text-emerald-600 hover:bg-slate-50 transition-colors" aria-label="Add item">
                    <Plus className="size-4 sm:size-5" />
                  </button>
                </div>
                <h4 className="font-bold text-slate-900 text-sm sm:text-[15px] truncate">
                  {typeof dish.name === 'object' ? (lang === 'ar' ? dish.name.ar || dish.name.en : dish.name.en || dish.name.ar) : dish.name}
                </h4>
                <p className="text-[13px] text-slate-500 font-medium truncate mt-0.5">{dish.tenantName}</p>
                <p className="text-[13px] font-semibold text-slate-700 mt-1">₪{dish.price}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
