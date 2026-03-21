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
  const lastFrameRef = useRef<number>(-1)
  const lastSizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 })
  const frameCount = frameUrls.length

  useEffect(() => {
    loadedCountRef.current = 0
    lastFrameRef.current = -1
    const imgs: HTMLImageElement[] = []
    const idleTimers: number[] = []
    const idleHandle: { id?: number } = {}
    const eagerCount = Math.min(frameUrls.length, 12)
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number
      cancelIdleCallback?: (id: number) => void
    }
    const enqueueImageLoad = (index: number, url: string, idle: boolean) => {
      const img = document.createElement('img')
      img.decoding = 'async'
      img.onload = () => {
        loadedCountRef.current++
        if (loadedCountRef.current >= 1) onFirstFrameReady()
      }
      img.onerror = () => {
        loadedCountRef.current++
        if (loadedCountRef.current >= 1) onFirstFrameReady()
      }
      imgs.push(img)
      if (!idle) {
        img.src = url
        return
      }
      if (w.requestIdleCallback) {
        idleHandle.id = w.requestIdleCallback(() => { img.src = url })
      } else {
        const t = window.setTimeout(() => { img.src = url }, 16 * Math.max(1, index - eagerCount + 1))
        idleTimers.push(t)
      }
    }

    frameUrls.forEach((url, index) => {
      enqueueImageLoad(index, url, index >= eagerCount)
    })

    imagesRef.current = imgs
    if (frameUrls.length === 0) onFirstFrameReady()
    return () => {
      if (idleHandle.id && w.cancelIdleCallback) {
        w.cancelIdleCallback(idleHandle.id)
      }
      idleTimers.forEach((id) => window.clearTimeout(id))
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      imagesRef.current = []
      lastFrameRef.current = -1
      lastSizeRef.current = { w: 0, h: 0, dpr: 1 }
      imgs.length = 0
    }
  }, [frameUrls, onFirstFrameReady])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const draw = (force = false) => {
      const imgs = imagesRef.current
      if (imgs.length === 0) return

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
        const sizeChanged = w !== lastSizeRef.current.w || h !== lastSizeRef.current.h || dpr !== lastSizeRef.current.dpr
        if (!force && frameIndex === lastFrameRef.current && !sizeChanged) return

        if (sizeChanged) {
          canvas.width = w * dpr
          canvas.height = h * dpr
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          lastSizeRef.current = { w, h, dpr }
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
        lastFrameRef.current = frameIndex
      }
    }

    const requestDraw = (force = false) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => draw(force))
    }

    requestDraw(true)
    const unsubscribe = progressMotionValue.on('change', () => requestDraw(false))
    const onResize = () => requestDraw(true)
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      unsubscribe()
      window.removeEventListener('resize', onResize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [frameCount, progressMotionValue])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 size-full"
    />
  )
}

export type ScrollAnimationData = {
  _id: string
  title: string
  scrollHeight: number
  frameCount: number
  frames: string[]
}

function ScrollAnimationSection({ data }: { data: ScrollAnimationData }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [framesReady, setFramesReady] = useState(false)
  const frameUrls = data.frames
  const scrollHeight = data.scrollHeight ?? 400
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
      aria-label={data.title}
    >
      <div className="relative sticky top-0 h-screen w-full bg-black">
        <div
          className="absolute inset-x-0 bottom-0 flex items-center justify-center overflow-hidden"
          style={{ top: 'calc(72px + env(safe-area-inset-top, 0px))' }}
        >
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

/**
 * Apple-style pinned scroll section. The API returns **one** random animation per load among
 * entries whose country/city targeting matches the visitor (no untargeted docs).
 */
export function ScrollDrivenBanner() {
  const [animation, setAnimation] = useState<ScrollAnimationData | null>(null)
  const [noAnimation, setNoAnimation] = useState(false)
  const { city } = useLocation()

  useEffect(() => {
    setNoAnimation(false)
    setAnimation(null)

    const params = new URLSearchParams()
    if (city) params.set('city', city)

    const ac = new AbortController()
    fetch(`/api/home/scroll-animations?${params.toString()}`, {
      signal: ac.signal,
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((data: { animation?: ScrollAnimationData | null }) => {
        if (ac.signal.aborted) return
        const a = data.animation
        if (a && a.frames.length >= 2) {
          setAnimation(a)
        } else {
          setNoAnimation(true)
        }
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (!ac.signal.aborted) setNoAnimation(true)
      })
    return () => ac.abort()
  }, [city])

  if (noAnimation || !animation) return null

  return <ScrollAnimationSection key={animation._id} data={animation} />
}
