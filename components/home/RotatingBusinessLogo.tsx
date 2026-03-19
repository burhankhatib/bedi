'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

type RotatingBusinessLogoProps = {
  children: ReactNode
  /** Extra classes on the perspective wrapper (e.g. align with grid) */
  className?: string
}

/** One full 360° flip takes 2s; next flip starts after 10s total (8s pause). */
const FLIP_DURATION_S = 2
const FLIP_INTERVAL_S = 10
const FLIP_PAUSE_S = FLIP_INTERVAL_S - FLIP_DURATION_S

/**
 * Full Y-axis 360° flip for free-delivery logos only. Respects `prefers-reduced-motion`.
 */
export function RotatingBusinessLogo({ children, className }: RotatingBusinessLogoProps) {
  const reduceMotion = useReducedMotion()

  return (
    <div className={cn('[perspective:800px]', className)}>
      <motion.div
        className="h-full w-full min-h-0 transform-gpu will-change-transform [transform-style:preserve-3d]"
        initial={false}
        animate={reduceMotion ? { rotateY: 0 } : { rotateY: [0, 360] }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                duration: FLIP_DURATION_S,
                repeat: Infinity,
                repeatDelay: FLIP_PAUSE_S,
                ease: 'linear',
              }
        }
      >
        {children}
      </motion.div>
    </div>
  )
}
