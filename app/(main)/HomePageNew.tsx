'use client'

import { Suspense, lazy, useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { useLanguage } from '@/components/LanguageContext'
import { SiteHeader } from '@/components/global/SiteHeader'
import { LocationGate } from '@/components/home/LocationGate'
import { HeroBannerFallback } from '@/components/home/HeroBanner'
import { CategoryIconsBar } from '@/components/home/CategoryIconsBar'
import { PublicFooter } from '@/components/saas/PublicFooter'
import { SubcategoriesSection } from '@/components/home/SubcategoriesSection'
import { PopularProductsSection } from '@/components/home/PopularProductsSection'
import { HomePageAuthSections } from '@/components/home/HomePageAuthSections'
import { StoreTypeSidebar } from '@/components/home/StoreTypeSidebar'
import { FeaturedTenants } from '@/components/home/FeaturedTenants'
import { PWAAppBanners } from '@/components/home/PWAAppBanners'
import { ScrollDrivenBanner } from '@/components/home/ScrollDrivenBanner'

const FRAME_COUNT = 31
function frameSrc(folder: string, i: number) {
  return `/banners/${folder}/burger-${String(i + 1).padStart(3, '0')}.jpg`
}

/** Starts preloading scroll-banner frames as soon as the homepage mounts */
function PreloadScrollBannerFrames() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = document.createElement('img')
      img.src = frameSrc('burger', i)
    }
  }, [])
  return null
}

const HeroBanner = lazy(() =>
  import('@/components/home/HeroBanner').then((m) => ({ default: m.HeroBanner }))
)

export function HomePageNew() {
  const { lang } = useLanguage()
  const isRtl = lang === 'ar'
  const [activeCategory, setActiveCategory] = useState('restaurant')

  return (
    <div className="min-h-screen bg-slate-50" dir={isRtl ? 'rtl' : 'ltr'}>
      <PreloadScrollBannerFrames />
      <SiteHeader variant="home" />
      <LocationGate>
        <main className="container mx-auto px-0 md:px-4 py-4 md:py-6 max-w-[1440px]">
          
          <div className="flex flex-col md:flex-row md:gap-8 mb-6 md:mb-8">
            {/* 1. Left Sidebar Navigation (Desktop) / Top Scroll (Mobile) */}
            <StoreTypeSidebar activeCategory={activeCategory} onChange={setActiveCategory} />

            {/* 2. Banner Area (Right Side of Sidebar) */}
            <div className="flex-1 min-w-0 flex flex-col gap-6 px-4 md:px-0">
               {/* Mobile Specialties Strip (Optional: Can keep above banner if preferred) */}
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
              >
                <CategoryIconsBar category={activeCategory} className="py-2.5" />
              </motion.section>

              {/* Banners — hidden when no hero banners published */}
              <motion.section
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.1, ease: [0.2, 0, 0, 1] }}
                className="w-full"
              >
                <Suspense fallback={<HeroBannerFallback />}>
                  <HeroBanner />
                </Suspense>
              </motion.section>
            </div>
          </div>

          {/* Apple-style scroll-driven banner — full viewport, no white gaps */}
          <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2">
            <ScrollDrivenBanner folder="burger" scrollHeight={400} />
          </div>

          {/* 3. Full Width Content Feed (Below animation) — dark background */}
          <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2 bg-black">
            <div className="container mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-12 md:gap-10 md:px-6 md:py-16 pb-16 w-full">
            {/* Featured Stores Feed for selected Category */}
            <FeaturedTenants category={activeCategory} />
            
            {/* Popular Products Row */}
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <PopularProductsSection />
            </motion.section>

            {/* PWA App Banners - Driver & Business apps */}
            <PWAAppBanners />

            {/* Dedicated Auth CTA Sections */}
            <HomePageAuthSections />
            </div>
          </div>
        </main>

        {/* Footer — dark, full width */}
        <div className="border-t border-neutral-800 bg-black">
          <PublicFooter />
        </div>
      </LocationGate>
    </div>
  )
}
