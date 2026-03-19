'use client'

import { useRef, useState } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from 'motion/react'
import Image from 'next/image'

const FRAME_COUNT = 61
const BANNER_FOLDER = 'burger'

function frameSrc(folder: string, i: number) {
  return `/banners/${folder}/ezgif-frame-${String(i + 1).padStart(3, '0')}.png`
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
 * animation. Frames advance 0→end. Only when done can user scroll to next section.
 */
export function ScrollDrivenBanner({
  folder = BANNER_FOLDER,
  frameCount = FRAME_COUNT,
  scrollHeight = 400,
}: ScrollDrivenBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [frameIndex, setFrameIndex] = useState(0)

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
      {/* Pinned: stays in viewport while user scrolls through the section */}
      <div className="sticky top-0 flex min-h-screen w-full items-center justify-center">
        <motion.div
          className="relative w-full max-w-full"
          style={{
            aspectRatio: '9 / 16',
            maxHeight: 'min(100vh - 1rem, 100vw * (16 / 9))',
            opacity,
            filter,
          }}
        >
          <Image
            src={frameSrc(folder, frameIndex)}
            alt=""
            fill
            className="object-contain"
            sizes="100vw"
            priority
            unoptimized
          />
        </motion.div>
      </div>
    </section>
  )
}
