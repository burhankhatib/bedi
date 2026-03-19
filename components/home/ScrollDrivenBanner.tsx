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

const BANNER_FOLDER = 'burger'

/** Loading placeholder while frames preload — logo + shimmer */
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

  // Preload images from URLs
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

  // requestAnimationFrame loop: read scroll, draw frame. No React state.
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
      className="absolute inset-0 h-full w-full object-contain"
      style={{ objectFit: 'contain' }}
    />
  )
}

type ScrollDrivenBannerProps = {
  folder?: string
  scrollHeight?: number
}

/**
 * Apple-style pinned scroll section. Auto-discovers frames in
 * /public/banners/{folder}/ (sorted by number in filename, e.g. 001-0100).
 * Canvas renders frames in rAF — no React re-renders during scroll.
 */
export function ScrollDrivenBanner({
  folder = BANNER_FOLDER,
  scrollHeight = 400,
}: ScrollDrivenBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [frameUrls, setFrameUrls] = useState<string[]>([])
  const [framesReady, setFramesReady] = useState(false)

  // Auto-discover frames from folder (sorted by number in filename)
  useEffect(() => {
    fetch(`/api/banners/frames?folder=${encodeURIComponent(folder)}`)
      .then((r) => r.json())
      .then((data: { frames?: string[] }) => {
        const urls = Array.isArray(data?.frames) ? data.frames : []
        setFrameUrls(urls)
        if (urls.length === 0) setFramesReady(true)
      })
      .catch(() => {
        setFrameUrls([])
        setFramesReady(true)
      })
  }, [folder])

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

  return (
    <section
      ref={containerRef}
      className="relative w-full bg-black"
      style={{ height: `${scrollHeight}vh` }}
    >
      {/* Center banner in visible viewport: paddingTop = header (72px) + safe-area + pb, so flex centers in (100vh - header) */}
      <div
        className="sticky top-0 flex min-h-screen w-full items-center justify-center px-2 sm:px-4 md:px-6 pb-6"
        style={{
          paddingTop: 'calc(72px + env(safe-area-inset-top, 0px) + 1.5rem)',
        }}
      >
        <motion.div
          className="relative w-full max-w-4xl overflow-hidden rounded-2xl md:rounded-3xl ring-1 ring-white/10 shadow-2xl bg-black"
          style={{
            aspectRatio: '9 / 16',
            maxHeight: 'min(calc(100vh - 6rem), 100vw * (16 / 9))',
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
    </section>
  )
}
