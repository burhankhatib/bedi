'use client'

import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Bike } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RotatingBusinessLogo } from '@/components/home/RotatingBusinessLogo'

export type FreeDeliveryLogoFrameProps = {
  /** When true, shows blue pulse + in-logo motorcycle sweep (no extra layout height). */
  active: boolean
  /** Light cards (search/home) vs dark featured strip */
  variant?: 'light' | 'dark'
  /** Screen reader + native tooltip (e.g. t('Free Delivery', 'توصيل مجاني')) */
  ariaLabel: string
  className?: string
  children: ReactNode
}

const ringKeyframes = {
  light: [
    'inset 0 0 0 2px rgba(14,165,233,0.35), 0 0 8px rgba(14,165,233,0.18)',
    'inset 0 0 0 2px rgba(2,132,199,0.9), 0 0 20px rgba(14,165,233,0.4)',
    'inset 0 0 0 2px rgba(14,165,233,0.35), 0 0 8px rgba(14,165,233,0.18)',
  ],
  dark: [
    'inset 0 0 0 2px rgba(56,189,248,0.32), 0 0 10px rgba(56,189,248,0.14)',
    'inset 0 0 0 2px rgba(125,211,252,0.88), 0 0 24px rgba(56,189,248,0.42)',
    'inset 0 0 0 2px rgba(56,189,248,0.32), 0 0 10px rgba(56,189,248,0.14)',
  ],
}

const stripGradient = {
  light: 'linear-gradient(to top, rgba(3,105,161,0.94) 0%, rgba(3,105,161,0.48) 55%, transparent 100%)',
  dark: 'linear-gradient(to top, rgba(12,74,110,0.94) 0%, rgba(12,74,110,0.5) 55%, transparent 100%)',
}

/**
 * Free-delivery affordance that stays inside the logo box (same card height as peers).
 * Motion inspired by the business “delivery requested” toast (Bike sweep).
 */
export function FreeDeliveryLogoFrame({
  active,
  variant = 'light',
  ariaLabel,
  className,
  children,
}: FreeDeliveryLogoFrameProps) {
  const vk = variant === 'dark' ? 'dark' : 'light'

  return (
    <div
      className={cn('relative shrink-0 overflow-hidden', className)}
      title={active ? ariaLabel : undefined}
    >
      <div className="relative z-0 h-full w-full min-h-0">
        {active ? (
          <RotatingBusinessLogo className="block h-full w-full">{children}</RotatingBusinessLogo>
        ) : (
          children
        )}
      </div>
      {active && (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[1] rounded-[inherit]"
            initial={false}
            animate={{ boxShadow: ringKeyframes[vk] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[30%] min-h-[22px] max-h-[32px] overflow-hidden rounded-b-[inherit]"
            style={{ background: stripGradient[vk] }}
          >
            <div className="absolute inset-0 flex items-end overflow-hidden pb-0.5 opacity-95">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: '-200%' }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="flex min-w-full items-end justify-end gap-10 pr-2"
              >
                <Bike className="size-[15px] shrink-0 text-white drop-shadow-md" />
                <Bike className="size-[15px] shrink-0 text-white/90 drop-shadow" />
                <Bike className="size-[15px] shrink-0 text-white/80 drop-shadow" />
              </motion.div>
            </div>
          </div>
          <span className="sr-only">{ariaLabel}</span>
        </>
      )}
    </div>
  )
}
