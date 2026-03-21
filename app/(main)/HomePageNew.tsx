'use client'

import { Suspense, lazy, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useLanguage } from '@/components/LanguageContext'
import { SiteHeader } from '@/components/global/SiteHeader'
import { LocationGate } from '@/components/home/LocationGate'
import { HeroBannerFallback } from '@/components/home/HeroBanner'
import { CategoryIconsBar } from '@/components/home/CategoryIconsBar'
import { PublicFooter } from '@/components/saas/PublicFooter'
import { PopularProductsSection } from '@/components/home/PopularProductsSection'
import { HomePageAuthSections } from '@/components/home/HomePageAuthSections'
import { FeaturedTenants } from '@/components/home/FeaturedTenants'
import { ScrollDrivenBanner } from '@/components/home/ScrollDrivenBanner'
import { Store, UtensilsCrossed } from 'lucide-react'

const HeroBanner = lazy(() =>
  import('@/components/home/HeroBanner').then((m) => ({ default: m.HeroBanner }))
)

export function HomePageNew() {
  const { lang, t } = useLanguage()
  const isRtl = lang === 'ar'
  const [activeCategory, setActiveCategory] = useState<'restaurant' | 'stores'>('restaurant')
  const [showSubcategories, setShowSubcategories] = useState(false)
  const m3Ease = [0.2, 0, 0, 1] as const

  return (
    <div className="min-h-screen bg-slate-50" dir={isRtl ? 'rtl' : 'ltr'}>
      <SiteHeader variant="home" />
      <LocationGate>
        <main className="mx-auto w-full max-w-none px-0 py-4 md:py-6">
          {/* 1. Business category (Restaurant / Store) OR sub-categories with back */}
          <div className="w-full px-4 sm:px-6">
            <AnimatePresence mode="wait" initial={false}>
              {!showSubcategories ? (
                <motion.section
                  key="business-categories"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: m3Ease }}
                  className="pt-1"
                >
                  <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCategory('restaurant')
                        setShowSubcategories(true)
                      }}
                      className="group rounded-2xl border border-slate-300/70 bg-white px-4 py-4 text-left shadow-sm transition-all hover:border-brand-yellow/70 hover:shadow-md"
                    >
                      <div className="flex items-center gap-2 text-slate-800">
                        <UtensilsCrossed className="size-5 text-brand-black" />
                        <span className="font-semibold">{t('Restaurant', 'مطعم')}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {t('Meals, cuisines and specialties', 'وجبات ومطابخ وتخصصات')}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveCategory('stores')
                        setShowSubcategories(true)
                      }}
                      className="group rounded-2xl border border-slate-300/70 bg-white px-4 py-4 text-left shadow-sm transition-all hover:border-brand-yellow/70 hover:shadow-md"
                    >
                      <div className="flex items-center gap-2 text-slate-800">
                        <Store className="size-5 text-brand-black" />
                        <span className="font-semibold">{t('Store', 'متجر')}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {t('Grocery, pharmacy, butcher, gas, water', 'بقالة، صيدلية، ملحمة، غاز، ماء')}
                      </p>
                    </button>
                  </div>
                </motion.section>
              ) : (
                <motion.section
                  key={`subcategories-${activeCategory}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: m3Ease }}
                  className="pt-2"
                >
                  <CategoryIconsBar
                    category={activeCategory}
                    className="py-2"
                    stickyBack={{
                      onClick: () => setShowSubcategories(false),
                      ariaLabel: t('Back to business categories', 'العودة إلى فئات النشاط'),
                    }}
                  />
                </motion.section>
              )}
            </AnimatePresence>
          </div>

          {/* 3. Hero — full viewport width, natural height */}
          <motion.section
            initial={{ opacity: 0, scale: 0.995 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.06, ease: m3Ease }}
            className="mt-4 w-full"
          >
            <Suspense fallback={<HeroBannerFallback />}>
              <HeroBanner />
            </Suspense>
          </motion.section>

          {/* Scroll-driven banner — full bleed */}
          <div className="relative left-1/2 mt-6 w-screen max-w-none -translate-x-1/2 px-0">
            <ScrollDrivenBanner />
          </div>

          {/* Featured tenants — light surface */}
          <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2 bg-white">
            <div className="mx-auto w-full max-w-none px-4 pb-10 pt-2 md:px-6 md:pb-12">
              <FeaturedTenants category={activeCategory} />
            </div>
          </div>

          {/* Popular + auth — dark feed */}
          <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2 bg-black">
            <div className="mx-auto flex w-full max-w-none flex-col gap-8 px-4 py-12 md:gap-10 md:px-6 md:py-16 pb-16">
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.2, ease: m3Ease }}
              >
                <PopularProductsSection />
              </motion.section>

              <HomePageAuthSections />
            </div>
          </div>
        </main>

        <div className="border-t border-neutral-800 bg-black">
          <PublicFooter />
        </div>
      </LocationGate>
    </div>
  )
}
