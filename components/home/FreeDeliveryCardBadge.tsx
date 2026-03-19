'use client'

import { motion } from 'motion/react'
import { Truck } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FreeDeliveryCardBadgeProps = {
  /** e.g. t('Free Delivery', 'توصيل مجاني') */
  label: string
  variant?: 'light' | 'dark'
  className?: string
}

/**
 * Sits above the logo (absolute; does not add card height). Keeps the animated delivery strip visible.
 */
export function FreeDeliveryCardBadge({ label, variant = 'light', className }: FreeDeliveryCardBadgeProps) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26, mass: 0.6 }}
      className={cn(
        'pointer-events-none absolute left-1/2 z-[8] -translate-x-1/2 bottom-[calc(100%+8px)]',
        'inline-flex max-w-[calc(100vw/2-2.5rem)] items-center justify-center gap-0.5 rounded-full border px-1.5 py-0.5 shadow-md sm:max-w-none',
        'text-[9px] font-bold leading-tight tracking-wide sm:gap-1 sm:px-2.5 sm:py-1 sm:text-[11px]',
        variant === 'dark'
          ? 'border-sky-400/75 bg-gradient-to-b from-sky-600 to-sky-800 text-sky-50 shadow-black/35'
          : 'border-sky-400/70 bg-gradient-to-b from-white to-sky-50 text-sky-800 shadow-slate-300/70',
        className
      )}
    >
      <Truck className="size-2.5 shrink-0 opacity-95 sm:size-3.5" aria-hidden />
      <span className="truncate">{label}</span>
    </motion.span>
  )
}
