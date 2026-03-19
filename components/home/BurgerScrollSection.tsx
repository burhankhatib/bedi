'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'motion/react'
import Image from 'next/image'

/** Single layer: image URL and accessibility label */
export type BurgerLayer = {
  src: string
  alt: string
}

type BurgerScrollSectionProps = {
  /** Burger layers from bottom to top (bun bottom, patty, cheese, etc.) */
  layers: BurgerLayer[]
  /** Section title shown before assembly begins */
  title?: string
  /** Scroll height in vh — controls how much scroll to complete assembly */
  scrollHeight?: number
}

/**
 * Returns 0-1 progress for a given layer: 0 = above viewport, 1 = settled in place.
 * Layers are evenly distributed across scroll; each layer "falls in" over its segment.
 */
function layerProgress(globalProgress: number, layerIndex: number, total: number): number {
  const segmentStart = (layerIndex + 1) / (total + 2)
  const segmentEnd = (layerIndex + 2) / (total + 2)
  const segmentSpan = segmentEnd - segmentStart
  const inSegment = Math.max(0, Math.min(1, (globalProgress - segmentStart) / segmentSpan))
  return Math.min(1, inSegment * 1.2)
}

export function BurgerScrollSection({
  layers,
  title = 'Build Your Perfect Mushroom Cheese Burger',
  scrollHeight = 400,
}: BurgerScrollSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  })

  const titleOpacity = useTransform(
    scrollYProgress,
    [0, 1 / (layers.length + 2)],
    [1, 0]
  )

  return (
    <section
      ref={containerRef}
      className="relative bg-neutral-950"
      style={{ height: `${scrollHeight}vh` }}
    >
      {/* Pinned viewport — stays fixed while user scrolls through the section */}
      <div className="sticky top-0 flex min-h-screen w-full flex-col items-center justify-center gap-6 px-4 py-12 md:flex-row md:gap-12 md:px-8 lg:gap-16">
        {/* Burger composition — centered */}
        <div
          className="relative flex shrink-0 items-center justify-center md:w-1/2"
          style={{
            width: 'min(90vw, 360px)',
            aspectRatio: '1',
          }}
        >
          {/* Plate/surface background — always visible */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            aria-hidden
          >
            <div className="h-[65%] w-[65%] rounded-full bg-gradient-to-b from-neutral-800/80 to-neutral-900/80" />
          </div>
          <div className="absolute inset-0">
            {layers.map((layer, i) => (
              <BurgerLayer
                key={layer.src}
                layer={layer}
                scrollYProgress={scrollYProgress}
                layerIndex={i}
                totalLayers={layers.length}
              />
            ))}
            </div>
        </div>

        {/* Text — minimal on mobile, full on desktop */}
        <div className="flex max-w-md flex-col items-center text-center md:items-start md:text-left">
          <motion.p
            className="text-base font-medium text-neutral-400 md:text-xl"
            style={{ opacity: titleOpacity }}
          >
            {title}
          </motion.p>
          <div className="hidden md:block">
            <ScrollRevealText
              scrollYProgress={scrollYProgress}
              layers={layers}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function BurgerLayer({
  layer,
  scrollYProgress,
  layerIndex,
  totalLayers,
}: {
  layer: BurgerLayer
  scrollYProgress: ReturnType<typeof useScroll>['scrollYProgress']
  layerIndex: number
  totalLayers: number
}) {
  const yRaw = useTransform(scrollYProgress, (p) => {
    const lp = layerProgress(p, layerIndex, totalLayers)
    return (1 - lp) * -30
  })
  const opacityRaw = useTransform(scrollYProgress, (p) => {
    const lp = layerProgress(p, layerIndex, totalLayers)
    return Math.min(1, lp * 1.5)
  })
  const ySpring = useSpring(yRaw, { stiffness: 80, damping: 25 })
  const opacity = useSpring(opacityRaw, { stiffness: 100, damping: 30 })
  const y = useTransform(ySpring, (v) => `${v}%`)

  return (
    <motion.div
      className="absolute inset-0"
      style={{ y, opacity }}
    >
      <Image
        src={layer.src}
        alt={layer.alt}
        fill
        className="object-contain drop-shadow-lg"
        sizes="(max-width: 768px) 90vw, 360px"
        unoptimized
      />
    </motion.div>
  )
}

/** Tags showing layer names — fade in as assembly completes */
function ScrollRevealText({
  scrollYProgress,
  layers,
}: {
  scrollYProgress: ReturnType<typeof useScroll>['scrollYProgress']
  layers: BurgerLayer[]
}) {
  const opacity = useTransform(
    scrollYProgress,
    [layers.length / (layers.length + 2), 1],
    [0.3, 1]
  )

  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
      {layers.map((layer) => (
        <motion.span
          key={layer.src}
          className="rounded-full bg-neutral-800/80 px-3 py-1 text-sm text-neutral-300"
          style={{ opacity }}
        >
          {layer.alt}
        </motion.span>
      ))}
    </div>
  )
}
