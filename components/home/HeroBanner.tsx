'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'motion/react'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'

/** Creative loading placeholder for hero banner: logo + Motion shimmer */
function BannerLoadingPlaceholder() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="relative h-20 w-20 sm:h-24 sm:w-24"
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.9, 1, 0.9],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <Image
          src="/logo.webp"
          alt=""
          fill
          className="object-contain"
          sizes="96px"
          priority
        />
      </motion.div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-amber-400/80"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}

function BannerMedia({
  bannerType,
  imageUrlDesktop,
  imageUrlMobile,
  textTitle,
  textDescription,
  textButtonLabel,
  backgroundColor,
  textColor,
}: {
  bannerType?: string
  imageUrlDesktop?: string | null
  imageUrlMobile?: string | null
  textTitle?: string
  textDescription?: string
  textButtonLabel?: string
  backgroundColor?: string
  textColor?: string
}) {
  const [isMobile, setIsMobile] = useState(false)
  const [mediaLoaded, setMediaLoaded] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = () => setIsMobile(mq.matches)
    handler()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  if (bannerType === 'text') {
    return (
      <div 
        className="flex h-full w-full flex-col justify-center px-6 py-4 sm:px-10 sm:py-6"
        style={{ backgroundColor: backgroundColor || '#111827', color: textColor || '#ffffff' }}
      >
        {textTitle && <h3 className="text-lg sm:text-2xl font-bold mb-1 sm:mb-2">{textTitle}</h3>}
        {textDescription && <p className="text-sm sm:text-base opacity-90 mb-3 sm:mb-4 max-w-sm line-clamp-2">{textDescription}</p>}
        {textButtonLabel && (
          <div className="mt-auto">
            <span className="inline-flex items-center justify-center rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-white/30">
              {textButtonLabel}
            </span>
          </div>
        )}
      </div>
    )
  }

  const imageUrl = isMobile
    ? (imageUrlMobile ?? imageUrlDesktop)
    : (imageUrlDesktop ?? imageUrlMobile)

  if (!imageUrl) return <div className="h-full w-full bg-slate-100" />

  return (
    <div className="relative w-full h-full bg-slate-100">
      <AnimatePresence>
        {!mediaLoaded && (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-slate-100">
            <BannerLoadingPlaceholder />
          </div>
        )}
      </AnimatePresence>
      <Image
        src={imageUrl}
        alt=""
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 500px"
        priority
        onLoad={() => setMediaLoaded(true)}
      />
    </div>
  )
}

type Banner = {
  _id: string
  bannerType?: string
  imageUrlDesktop?: string | null
  imageUrlMobile?: string | null
  textTitle?: string
  textDescription?: string
  textButtonLabel?: string
  backgroundColor?: string
  textColor?: string
  href: string | null
  desktopAspect?: number | null
  mobileAspect?: number | null
}

export function HeroBanner() {
  const { city } = useLocation()
  const { lang } = useLanguage()
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Always fetch: global banners (no city/country in CMS) must show even before a city is chosen.
    // When `city` is set, the API still filters banners that list specific cities only.
    const ac = new AbortController()
    const loadId = requestAnimationFrame(() => setLoading(true))
    const params = new URLSearchParams()
    params.set('lang', lang)
    if (city) params.set('city', city)
    fetch(`/api/home/banners?${params}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (ac.signal.aborted) return
        if (Array.isArray(data)) {
          setBanners(data)
        } else {
          setBanners(Array.isArray(data?.banners) ? data.banners : [])
        }
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (!ac.signal.aborted) {
          setBanners([])
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })
    return () => {
      cancelAnimationFrame(loadId)
      ac.abort()
    }
  }, [city, lang])

  if (loading) {
    return (
      <section className="relative w-full mx-auto max-w-none pt-2 pb-4 overflow-hidden">
        <div className="flex overflow-x-auto gap-4 px-4 sm:px-6 pb-2 no-scrollbar snap-x snap-mandatory">
          {[1, 2].map((i) => (
            <motion.div
              key={i}
              className="relative shrink-0 snap-center w-[300px] h-[160px] sm:w-[500px] sm:h-[280px] overflow-hidden rounded-2xl bg-slate-100"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <BannerLoadingPlaceholder />
            </motion.div>
          ))}
        </div>
      </section>
    )
  }
  if (banners.length === 0) return null

  return (
    <section className="relative w-full mx-auto max-w-none pt-2 pb-4 overflow-hidden">
      <div className="flex overflow-x-auto gap-4 px-4 sm:px-6 pb-2 no-scrollbar snap-x snap-mandatory">
        {banners.map((current) => {
          return (
            <div 
              key={current._id} 
              className="relative shrink-0 snap-center w-[300px] h-[160px] sm:w-[500px] sm:h-[280px] overflow-hidden rounded-2xl shadow-sm bg-slate-100"
            >
              {current.href ? (
                <Link href={current.href} className="block w-full h-full">
                  <BannerMedia
                    bannerType={current.bannerType}
                    imageUrlDesktop={current.imageUrlDesktop}
                    imageUrlMobile={current.imageUrlMobile}
                    textTitle={current.textTitle}
                    textDescription={current.textDescription}
                    textButtonLabel={current.textButtonLabel}
                    backgroundColor={current.backgroundColor}
                    textColor={current.textColor}
                  />
                </Link>
              ) : (
                <BannerMedia
                  bannerType={current.bannerType}
                  imageUrlDesktop={current.imageUrlDesktop}
                  imageUrlMobile={current.imageUrlMobile}
                  textTitle={current.textTitle}
                  textDescription={current.textDescription}
                  textButtonLabel={current.textButtonLabel}
                  backgroundColor={current.backgroundColor}
                  textColor={current.textColor}
                />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Fallback for Suspense while HeroBanner chunk or data loads */
export function HeroBannerFallback() {
  return (
    <section className="relative w-full mx-auto max-w-none pt-2 pb-4 overflow-hidden">
      <div className="flex overflow-x-auto gap-4 px-4 sm:px-6 pb-2 no-scrollbar snap-x snap-mandatory">
        <div className="relative shrink-0 snap-center w-[300px] h-[160px] sm:w-[500px] sm:h-[280px] overflow-hidden rounded-2xl bg-slate-100">
          <BannerLoadingPlaceholder />
        </div>
      </div>
    </section>
  )
}
