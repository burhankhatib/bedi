'use client'

import { Suspense, lazy } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { useLanguage } from '@/components/LanguageContext'
import { SiteHeader } from '@/components/global/SiteHeader'
import { LocationGate } from '@/components/home/LocationGate'
import { HeroBannerFallback } from '@/components/home/HeroBanner'
import { CategoryGrid } from '@/components/home/CategoryGrid'
import { PublicFooter } from '@/components/saas/PublicFooter'

const HeroBanner = lazy(() =>
  import('@/components/home/HeroBanner').then((m) => ({ default: m.HeroBanner }))
)
import { SubcategoriesSection } from '@/components/home/SubcategoriesSection'
import { PopularProductsSection } from '@/components/home/PopularProductsSection'
import { HomePageAuthSections } from '@/components/home/HomePageAuthSections'

export function HomePageNew() {
  const { t, lang } = useLanguage()
  const isRtl = lang === 'ar'

  return (
    <div className="min-h-screen bg-slate-50" dir={isRtl ? 'rtl' : 'ltr'}>
      <SiteHeader variant="home" />
      <LocationGate>
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full"
        >
          <Suspense fallback={<HeroBannerFallback />}>
            <HeroBanner />
          </Suspense>
        </motion.section>

        <main className="container mx-auto px-4 py-6 sm:py-8">
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <CategoryGrid />
          </motion.section>

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <SubcategoriesSection />
          </motion.section>

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <PopularProductsSection />
          </motion.section>

          {/* Dedicated sections: Tenants (business) and Drivers — separate design and login for better UX */}
          <HomePageAuthSections />

          <div className="mt-16">
            <PublicFooter />
          </div>
        </main>
      </LocationGate>
    </div>
  )
}
