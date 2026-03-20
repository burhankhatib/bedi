'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'

// Fallback aspect ratios when Sanity doesn't return dimensions (legacy images)
const DESKTOP_ASPECT_FALLBACK = 16 / 9
const MOBILE_ASPECT_FALLBACK = 1

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
  imageUrlDesktop,
  imageUrlMobile,
  videoUrlDesktop,
  videoUrlMobile,
  onVideoEnded,
  loopVideo,
  aspect,
}: {
  imageUrlDesktop: string | null
  imageUrlMobile: string | null
  videoUrlDesktop: string | null
  videoUrlMobile: string | null
  onVideoEnded?: () => void
  loopVideo?: boolean
  /** Width/height ratio for responsive image (natural height = width/aspect). */
  aspect: number
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

  // Desktop viewport → Desktop Image, mobile viewport → Mobile Image (match Sanity field labels)
  const videoUrl = isMobile
    ? (videoUrlMobile ?? videoUrlDesktop)
    : (videoUrlDesktop ?? videoUrlMobile)
  const imageUrl = isMobile
    ? (imageUrlMobile ?? imageUrlDesktop)
    : (imageUrlDesktop ?? imageUrlMobile)

  const imgBaseW = 1920
  const safeAspect = aspect > 0 ? aspect : (isMobile ? MOBILE_ASPECT_FALLBACK : DESKTOP_ASPECT_FALLBACK)
  const imgBaseH = Math.max(1, Math.round(imgBaseW / safeAspect))

  // Video is priority when available; full width, height follows media
  if (videoUrl) {
    return (
      <div className="relative w-full bg-black">
        <AnimatePresence>
          {!mediaLoaded && (
            <div className="absolute inset-0 z-[1] min-h-[200px]">
              <BannerLoadingPlaceholder />
            </div>
          )}
        </AnimatePresence>
        <video
          src={videoUrl}
          poster={imageUrl ?? undefined}
          muted
          autoPlay
          playsInline
          loop={loopVideo}
          className="block h-auto w-full"
          aria-hidden
          onEnded={loopVideo ? undefined : onVideoEnded}
          onLoadedData={() => setMediaLoaded(true)}
          onCanPlay={() => setMediaLoaded(true)}
        />
      </div>
    )
  }

  if (!imageUrl) return <div className="min-h-[120px] w-full bg-black" />

  return (
    <div className="relative w-full bg-black">
      <AnimatePresence>
        {!mediaLoaded && (
          <div className="absolute inset-0 z-[1] flex min-h-[200px] items-center justify-center bg-black">
            <BannerLoadingPlaceholder />
          </div>
        )}
      </AnimatePresence>
      <Image
        src={imageUrl}
        alt=""
        width={imgBaseW}
        height={imgBaseH}
        className="h-auto w-full object-cover"
        sizes="100vw"
        priority
        onLoad={() => setMediaLoaded(true)}
      />
    </div>
  )
}

type Banner = {
  _id: string
  imageUrlDesktop: string | null
  imageUrlMobile: string | null
  videoUrlDesktop: string | null
  videoUrlMobile: string | null
  href: string | null
  desktopAspect?: number | null
  mobileAspect?: number | null
}

export function HeroBanner() {
  const { city, isChosen } = useLocation()
  const { lang } = useLanguage()
  const [banners, setBanners] = useState<Banner[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = () => setIsMobile(mq.matches)
    handler()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const [imageDurationSeconds, setImageDurationSeconds] = useState(10)

  useEffect(() => {
    if (!isChosen || !city) {
      const resetId = requestAnimationFrame(() => {
        setBanners([])
        setLoading(false)
      })
      return () => cancelAnimationFrame(resetId)
    }
    const ac = new AbortController()
    const loadId = requestAnimationFrame(() => setLoading(true))
    const params = new URLSearchParams()
    params.set('lang', lang)
    params.set('city', city)
    fetch(`/api/home/banners?${params}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (ac.signal.aborted) return
        if (Array.isArray(data)) {
          setBanners(data)
          setImageDurationSeconds(10)
        } else {
          setBanners(Array.isArray(data?.banners) ? data.banners : [])
          const sec = data?.imageDurationSeconds
          setImageDurationSeconds(
            typeof sec === 'number' && sec >= 3 && sec <= 120 ? sec : 10
          )
        }
        setIndex(0)
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
  }, [isChosen, city, lang])

  const currentIsVideo = (() => {
    if (banners.length === 0) return false
    const cur = banners[index]
    if (!cur) return false
    const url = isMobile
      ? (cur.videoUrlMobile ?? cur.videoUrlDesktop)
      : (cur.videoUrlDesktop ?? cur.videoUrlMobile)
    return Boolean(url)
  })()

  const advanceToNext = useCallback(() => {
    setIndex((i) => (i + 1) % banners.length)
  }, [banners.length])

  useEffect(() => {
    if (banners.length <= 1) return
    if (currentIsVideo) return
    const ms = imageDurationSeconds * 1000
    const id = setInterval(advanceToNext, ms)
    return () => clearInterval(id)
  }, [banners.length, currentIsVideo, imageDurationSeconds, advanceToNext])

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + banners.length) % banners.length)
  }, [banners.length])

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % banners.length)
  }, [banners.length])

  if (loading) {
    return (
      <section className="relative w-full bg-black">
        <motion.div
          className="relative h-[320px] w-full overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <BannerLoadingPlaceholder />
        </motion.div>
      </section>
    )
  }
  if (banners.length === 0) return null

  const current = banners[index]!
  const aspect =
    isMobile
      ? (current.mobileAspect ?? current.desktopAspect ?? MOBILE_ASPECT_FALLBACK)
      : (current.desktopAspect ?? current.mobileAspect ?? DESKTOP_ASPECT_FALLBACK)

  return (
    <section className="relative w-full bg-black">
      <div className="relative w-full overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={current._id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
            className="relative w-full"
          >
            {current.href ? (
              <Link href={current.href} className="block w-full">
                <BannerMedia
                  imageUrlDesktop={current.imageUrlDesktop}
                  imageUrlMobile={current.imageUrlMobile}
                  videoUrlDesktop={current.videoUrlDesktop}
                  videoUrlMobile={current.videoUrlMobile}
                  onVideoEnded={banners.length > 1 ? advanceToNext : undefined}
                  loopVideo={banners.length === 1}
                  aspect={aspect}
                />
              </Link>
            ) : (
              <BannerMedia
                imageUrlDesktop={current.imageUrlDesktop}
                imageUrlMobile={current.imageUrlMobile}
                videoUrlDesktop={current.videoUrlDesktop}
                videoUrlMobile={current.videoUrlMobile}
                onVideoEnded={banners.length > 1 ? advanceToNext : undefined}
                loopVideo={banners.length === 1}
                aspect={aspect}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {banners.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute start-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/60"
              aria-label="Previous banner"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute end-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/60"
              aria-label="Next banner"
            >
              <ChevronRight className="size-6" />
            </button>

            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
              {banners.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === index ? 'w-6 bg-white' : 'w-2 bg-white/60 hover:bg-white/80'
                  }`}
                  aria-label={`Go to banner ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

/** Fallback for Suspense while HeroBanner chunk or data loads */
export function HeroBannerFallback() {
  return (
    <section className="relative w-full bg-black">
      <div className="relative h-[320px] w-full overflow-hidden bg-black">
        <BannerLoadingPlaceholder />
      </div>
    </section>
  )
}
