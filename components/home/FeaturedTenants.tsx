'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'motion/react'
import { Store } from 'lucide-react'
import { FreeDeliveryLogoFrame } from '@/components/home/FreeDeliveryLogoFrame'
import { FreeDeliveryCardBadge } from '@/components/home/FreeDeliveryCardBadge'
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
  freeDeliveryEnabled?: boolean
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
      <section className="pt-2 pb-8">
        <h2 className="mb-6 text-xl font-bold text-[#E6E1E5] md:text-2xl tracking-tight">
          {t('Featured places', 'أماكن مميزة')}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-[200px] animate-pulse rounded-[20px] bg-[#2B2930]"
            />
          ))}
        </div>
      </section>
    )
  }

  if (tenants.length === 0) {
    return (
      <section className="pt-2 pb-8">
        <div className="rounded-3xl border border-[#49454F] bg-[#2B2930] p-12 text-center">
          <Store className="mx-auto size-16 text-[#938F99]" />
          <p className="mt-4 text-[#CAC4D0] font-medium text-lg">
            {t('No businesses found here yet.', 'لا توجد أعمال هنا بعد.')}
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="pt-2 pb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#E6E1E5] md:text-2xl tracking-tight">
          {t('Featured places to order', 'أماكن مميزة للطلب')}
        </h2>
        <Link href={`/search?category=${category}`} className="text-sm font-semibold text-amber-400 hover:text-amber-300 hidden sm:block transition-colors">
          {t('See All', 'عرض الكل')}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tenants.slice(0, 12).map((tStore, i) => (
          <motion.div
            key={tStore._id}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0, 0, 1], delay: Math.min(i * 0.04, 0.4) }}
          >
            <Link
              href={tStore.slug ? `/t/${tStore.slug}` : '#'}
              className={`group flex flex-col items-center rounded-[20px] bg-[#2B2930] p-4 pb-5 transition-all duration-300 border border-[#49454F] hover:border-amber-400/50 hover:bg-[#36343B] ${
                tStore.freeDeliveryEnabled ? 'overflow-visible' : 'overflow-hidden'
              }`}
            >
              <div className="relative mb-3 shrink-0">
                <FreeDeliveryLogoFrame
                  active={tStore.freeDeliveryEnabled === true}
                  variant="dark"
                  ariaLabel={t('Free Delivery', 'توصيل مجاني')}
                  className="size-[80px] sm:size-[88px] rounded-2xl bg-[#36343B] border border-[#49454F] group-hover:scale-[1.03] transition-transform duration-300"
                >
                  {tStore.logoUrl ? (
                    <Image
                      src={tStore.logoUrl}
                      alt={(lang === 'ar' ? tStore.name_ar : tStore.name_en) || tStore.name}
                      fill
                      className="object-contain p-2"
                      sizes="88px"
                    />
                  ) : (
                    <div className="relative flex h-full w-full items-center justify-center">
                      <Store className="size-9 text-[#938F99]" />
                    </div>
                  )}
                </FreeDeliveryLogoFrame>
                {tStore.freeDeliveryEnabled && (
                  <FreeDeliveryCardBadge label={t('Free Delivery', 'توصيل مجاني')} variant="dark" />
                )}
              </div>

              <h2 className="font-bold text-[#E6E1E5] text-[17px] sm:text-[19px] tracking-tight text-center line-clamp-2 group-hover:text-amber-400 transition-colors w-full">
                {(lang === 'ar' ? tStore.name_ar : tStore.name_en) || tStore.name}
              </h2>

              <p className="mt-1 text-[13px] text-[#CAC4D0] capitalize font-medium">
                {lang === 'ar'
                  ? BUSINESS_TYPES.find((b) => b.value === tStore.businessType)?.labelAr ??
                    tStore.businessType
                  : BUSINESS_TYPES.find((b) => b.value === tStore.businessType)?.label ??
                    tStore.businessType}
              </p>

              {tStore.sections.length > 0 && (
                <p className="mt-1 text-[12px] text-[#938F99] line-clamp-2 text-center">
                  {tStore.sections
                    .map((s) => (lang === 'ar' ? s.ar || s.en : s.en || s.ar))
                    .filter(Boolean)
                    .join(' • ')}
                </p>
              )}
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 flex justify-center sm:hidden">
         <Link href={`/search?category=${category}`} className="w-full flex items-center justify-center h-12 rounded-full border border-[#49454F] font-semibold text-[#CAC4D0] hover:bg-[#36343B] hover:text-[#E6E1E5] transition">
            {t('See all stores', 'عرض جميع المتاجر')}
         </Link>
      </div>
    </section>
  )
}
