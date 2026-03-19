'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from 'motion/react'
import Image from 'next/image'
import type { MotionValue } from 'motion/react'
import { useLocation } from '@/components/LocationContext'

function BannerAnimationPlaceholder() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/90"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="relative h-16 w-16 sm:h-20 sm:w-20"
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
          sizes="80px"
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

/**
 * Canvas-based frame renderer. Apple-style: no React state during scroll,
 * draws directly in requestAnimationFrame for 60fps smoothness.
 */
function ScrollCanvas({
  frameUrls,
  progressMotionValue,
  onFirstFrameReady,
}: {
  frameUrls: string[]
  progressMotionValue: MotionValue<number>
  onFirstFrameReady: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef<HTMLImageElement[]>([])
  const loadedCountRef = useRef(0)
  const rafRef = useRef<number>(0)
  const frameCount = frameUrls.length

  useEffect(() => {
    loadedCountRef.current = 0
    const imgs: HTMLImageElement[] = []
    for (const url of frameUrls) {
      const img = document.createElement('img')
      img.onload = () => {
        loadedCountRef.current++
        if (loadedCountRef.current >= 1) onFirstFrameReady()
      }
      img.onerror = () => {
        loadedCountRef.current++
        if (loadedCountRef.current >= 1) onFirstFrameReady()
      }
      img.src = url
      imgs.push(img)
    }
    imagesRef.current = imgs
    if (frameUrls.length === 0) onFirstFrameReady()
    return () => {
      imgs.length = 0
    }
  }, [frameUrls, onFirstFrameReady])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const draw = () => {
      const imgs = imagesRef.current
      if (imgs.length === 0) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const progress = progressMotionValue.get()
      const frameIndex = Math.round(
        Math.max(0, Math.min(frameCount - 1, progress))
      )
      const img = imgs[frameIndex]

      if (img && img.complete && img.naturalWidth > 0) {
        const dpr = Math.min(window.devicePixelRatio ?? 1, 2)
        const rect = canvas.getBoundingClientRect()
        const w = rect.width
        const h = rect.height

        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr
          canvas.height = h * dpr
          ctx.scale(dpr, dpr)
        }

        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, w, h)

        const imgAspect = img.naturalWidth / img.naturalHeight
        const containerAspect = w / h
        let drawW: number, drawH: number, drawX: number, drawY: number

        if (imgAspect > containerAspect) {
          drawH = h
          drawW = h * imgAspect
          drawX = (w - drawW) / 2
          drawY = 0
        } else {
          drawW = w
          drawH = w / imgAspect
          drawX = 0
          drawY = (h - drawH) / 2
        }

        ctx.drawImage(img, drawX, drawY, drawW, drawH)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [frameCount, progressMotionValue])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 size-full"
    />
  )
}

type ScrollAnimationData = {
  _id: string
  title: string
  scrollHeight: number
  frameCount: number
  frames: string[]
}

/**
 * Apple-style pinned scroll section. Fetches the best-matching scroll
 * animation from Sanity (filtered by user city, expiry, enabled).
 * Canvas renders frames in rAF — no React re-renders during scroll.
 */
export function ScrollDrivenBanner() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [animationData, setAnimationData] = useState<ScrollAnimationData | null>(null)
  const [frameUrls, setFrameUrls] = useState<string[]>([])
  const [framesReady, setFramesReady] = useState(false)
  const [noAnimation, setNoAnimation] = useState(false)
  const { city } = useLocation()

  useEffect(() => {
    const params = new URLSearchParams()
    if (city) params.set('city', city)

    fetch(`/api/home/scroll-animations?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { animation: ScrollAnimationData | null }) => {
        if (data.animation && data.animation.frames.length >= 2) {
          setAnimationData(data.animation)
          setFrameUrls(data.animation.frames)
        } else {
          setNoAnimation(true)
        }
      })
      .catch(() => {
        setNoAnimation(true)
      })
  }, [city])

  const scrollHeight = animationData?.scrollHeight ?? 400
  const frameCount = Math.max(1, frameUrls.length)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  })

  const progressToFrame = useTransform(
    scrollYProgress,
    [0, 1],
    [0, frameCount - 1]
  )

  const introEnd = 5 / frameCount
  const opacity = useTransform(
    scrollYProgress,
    [0, introEnd, 0.95, 1],
    [0, 1, 1, 0.6]
  )
  const blur = useTransform(
    scrollYProgress,
    [0, introEnd],
    [20, 0]
  )
  const filter = useTransform(blur, (v) => `blur(${v}px)`)

  const handleFirstFrameReady = useCallback(() => setFramesReady(true), [])

  if (noAnimation) return null

  return (
    <section
      ref={containerRef}
      className="relative w-full bg-black"
      style={{ height: `${scrollHeight}vh` }}
    >
      <div className="relative sticky top-0 h-screen w-full bg-black">
        {/* Available area: from header bottom to viewport bottom, centered */}
        <div
          className="absolute inset-x-0 bottom-0 flex items-center justify-center overflow-hidden"
          style={{ top: 'calc(72px + env(safe-area-inset-top, 0px))' }}
        >
          {/*
            Explicit square: same expression for both axes (min(100vw, available height)).
            aspect-ratio + max-* only collapses to 0 inside flex without base size.
          */}
          <motion.div
            className="relative shrink-0 bg-black"
            style={{
              width:
                'min(100vw, calc(100vh - 72px - env(safe-area-inset-top, 0px)))',
              height:
                'min(100vw, calc(100vh - 72px - env(safe-area-inset-top, 0px)))',
              opacity,
              filter,
            }}
          >
          <AnimatePresence>
            {!framesReady && <BannerAnimationPlaceholder />}
          </AnimatePresence>
          {frameUrls.length > 0 && (
            <ScrollCanvas
              frameUrls={frameUrls}
              progressMotionValue={progressToFrame}
              onFirstFrameReady={handleFirstFrameReady}
            />
          )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
