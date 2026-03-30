'use client'

import { useRef, useState, useLayoutEffect, useEffect } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'

type Variant = 'accept' | 'decline'

/** Accept slider: 50% larger for easier control. Decline stays compact. */
const LARGE_TRACK_HEIGHT = 87
const LARGE_THUMB_SIZE = 72
const COMPACT_TRACK_HEIGHT = 48
const COMPACT_THUMB_SIZE = 40
const THRESHOLD = 0.82

const styleConfig: Record<Variant, { trackClass: string; thumbClass: string; fillClass: string; Icon: typeof Check }> = {
  accept: {
    trackClass: 'bg-green-900/60 border-green-600',
    thumbClass: 'bg-green-500',
    fillClass: 'bg-green-600/50',
    Icon: Check,
  },
  decline: {
    trackClass: 'bg-slate-800 border-slate-600',
    thumbClass: 'bg-slate-500',
    fillClass: 'bg-slate-600/50',
    Icon: X,
  },
}

type Props = {
  orderId: string
  variant: Variant
  onConfirm: (orderId: string) => Promise<void>
  disabled?: boolean
}

export function SlideToConfirm({ orderId, variant, onConfirm, disabled }: Props) {
  const { t } = useLanguage()
  const trackRef = useRef<HTMLDivElement>(null)
  const isCompact = variant === 'decline'
  const TRACK_HEIGHT = isCompact ? COMPACT_TRACK_HEIGHT : LARGE_TRACK_HEIGHT
  const THUMB_SIZE = isCompact ? COMPACT_THUMB_SIZE : LARGE_THUMB_SIZE
  const padding = isCompact ? 12 : 16
  const [maxDrag, setMaxDrag] = useState(200)
  const [isBusy, setIsBusy] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const mountedRef = useRef(true)
  const x = useMotionValue(0)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  const label = variant === 'accept' ? t('Slide to accept', 'اسحب لقبول') : t('Slide to decline', 'اسحب للرفض')
  const doneLabel = variant === 'accept' ? t('Accepted', 'تم القبول') : t('Declined', 'تم الرفض')
  const { trackClass, thumbClass, fillClass, Icon } = styleConfig[variant]

  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    const update = () => setMaxDrag(Math.max(0, el.offsetWidth - THUMB_SIZE - padding))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [THUMB_SIZE, padding])

  const progress = useTransform(x, [0, maxDrag], [0, 1])

  const handleDragEnd = () => {
    if (disabled || isBusy || isDone) return
    if (x.get() >= maxDrag * THRESHOLD) {
      setIsBusy(true)
      onConfirm(orderId)
        .then(() => { if (mountedRef.current) setIsDone(true) })
        .catch(() => {})
        .finally(() => { if (mountedRef.current) setIsBusy(false) })
    }
  }

  return (
    <div className="w-full" dir="ltr">
      <div
        ref={trackRef}
        className={`relative w-full rounded-xl border overflow-hidden touch-none ${trackClass}`}
        style={{ height: TRACK_HEIGHT }}
      >
        <motion.div
          className={`absolute left-1.5 top-1/2 -translate-y-1/2 rounded-xl flex items-center justify-center shadow z-10 cursor-grab active:cursor-grabbing ${thumbClass}`}
          style={{ width: THUMB_SIZE, height: TRACK_HEIGHT - padding, x }}
          drag="x"
          dragConstraints={{ left: 0, right: maxDrag }}
          dragElastic={0}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          onPointerUp={(e) => { try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {} }}
        >
          <Icon className={`text-white shrink-0 ${isCompact ? 'h-5 w-5' : 'h-8 w-8'}`} />
        </motion.div>
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-l-xl pointer-events-none ${fillClass}`}
          style={{ width: useTransform(progress, (v) => `${Math.min(1, v) * 100}%`) }}
        />
        <div className="absolute inset-0 flex items-center justify-end pr-4 pointer-events-none">
          <span className={`font-bold text-slate-200 ${isCompact ? 'text-sm' : 'text-base'}`}>
            {isBusy ? '...' : isDone ? doneLabel : label}
          </span>
        </div>
      </div>
    </div>
  )
}
