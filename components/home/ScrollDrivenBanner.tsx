'use client'

import { useRef, useState, useEffect } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  AnimatePresence,
} from 'motion/react'
import Image from 'next/image'

const FRAME_COUNT = 31
const BANNER_FOLDER = 'burger'

function frameSrc(folder: string, i: number) {
  return `/banners/${folder}/burger-${String(i + 1).padStart(3, '0')}.jpg`
}

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

type ScrollDrivenBannerProps = {
  /** Folder under /public/banners/ (e.g. 'burger') */
  folder?: string
  frameCount?: number
  /** Scroll height in vh — how much scroll to complete the animation (more = slower) */
  scrollHeight?: number
}

/**
 * Pinned scroll section: viewport stays fixed while user scrolls to drive the
 * animation. Frames advance 0→end. Preloads all frames on mount for smooth UX.
 */
export function ScrollDrivenBanner({
  folder = BANNER_FOLDER,
  frameCount = FRAME_COUNT,
  scrollHeight = 400,
}: ScrollDrivenBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const [framesReady, setFramesReady] = useState(false)

  // Preload all frame images on mount so scrolling is smooth
  useEffect(() => {
    if (typeof document === 'undefined') return
    let loaded = 0
    const target = frameCount
    const checkReady = () => {
      loaded++
      if (loaded >= Math.min(3, target)) {
        setFramesReady(true)
      }
    }
    for (let i = 0; i < frameCount; i++) {
      const img = document.createElement('img')
      img.onload = checkReady
      img.onerror = checkReady
      img.src = frameSrc(folder, i)
    }
    if (frameCount < 3) setFramesReady(true)
  }, [folder, frameCount])

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

  useMotionValueEvent(progressToFrame, 'change', (latest) => {
    const idx = Math.round(
      Math.max(0, Math.min(frameCount - 1, latest))
    )
    setFrameIndex(idx)
  })

  return (
    <section
      ref={containerRef}
      className="relative w-full bg-black"
      style={{ height: `${scrollHeight}vh` }}
    >
      {/* Pinned: stays in viewport. Pad top for header (~72px) so burger centers in visible black area. */}
      <div className="sticky top-0 flex min-h-screen w-full items-center justify-center px-2 sm:px-4 md:px-6 pt-[72px] pb-6">
        {/* Surrounding container: rounded frame, subtle ring, padding */}
        <motion.div
          className="relative w-full max-w-4xl overflow-hidden rounded-2xl md:rounded-3xl ring-1 ring-white/10 shadow-2xl"
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
          <Image
            src={frameSrc(folder, frameIndex)}
            alt=""
            fill
            className="object-contain"
            sizes="(min-width: 768px) 896px, 100vw"
            priority
            unoptimized
            onLoad={() => setFramesReady(true)}
          />
        </motion.div>
      </div>
    </section>
  )
}
