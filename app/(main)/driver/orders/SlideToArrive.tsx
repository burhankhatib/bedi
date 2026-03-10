'use client'

import { useRef, useState, useLayoutEffect } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'

type Props = {
  orderId: string
  onArrive: (orderId: string) => Promise<void>
  disabled?: boolean
}

const TRACK_HEIGHT = 87
const THUMB_SIZE = 72
const PADDING = 16
const THRESHOLD = 0.82

export function SlideToArrive({ orderId, onArrive, disabled }: Props) {
  const { t } = useLanguage()
  const trackRef = useRef<HTMLDivElement>(null)
  const [maxDrag, setMaxDrag] = useState(240)
  const [isArriving, setIsArriving] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const x = useMotionValue(0)

  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    const update = () => setMaxDrag(Math.max(0, el.offsetWidth - THUMB_SIZE - PADDING))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const progress = useTransform(x, [0, maxDrag], [0, 1])

  const handleDragEnd = () => {
    if (disabled || isArriving || isDone) return
    const current = x.get()
    if (current >= maxDrag * THRESHOLD) {
      setIsArriving(true)
      onArrive(orderId)
        .then(() => setIsDone(true))
        .catch(() => {})
        .finally(() => setIsArriving(false))
    }
  }

  return (
    <div className="mt-3" dir="ltr">
      <p className="text-base text-blue-400/90 mb-2 text-right font-medium">{t('Slide to confirm arrival', 'اسحب لتأكيد الوصول')}</p>
      <div
        ref={trackRef}
        className="relative w-full rounded-xl bg-blue-900/60 border border-blue-600 overflow-hidden touch-none"
        style={{ height: TRACK_HEIGHT }}
      >
        <motion.div
          className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg z-10 cursor-grab active:cursor-grabbing"
          style={{
            width: THUMB_SIZE,
            height: TRACK_HEIGHT - PADDING,
            x,
          }}
          drag="x"
          dragConstraints={{ left: 0, right: maxDrag }}
          dragElastic={0}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
        >
          <MapPin className="h-8 w-8 text-white shrink-0" />
        </motion.div>
        <motion.div
          className="absolute inset-y-0 left-0 rounded-l-xl bg-blue-600/50 pointer-events-none"
          style={{
            width: useTransform(progress, (v) => `${Math.min(1, v) * 100}%`),
          }}
        />
        <div className="absolute inset-0 flex items-center justify-end pr-4 pointer-events-none">
          <span className="text-base font-bold text-blue-200">
            {isArriving ? '...' : isDone ? t('Arrived!', 'وصلت!') : t('Slide to confirm arrival', 'اسحب لتأكيد الوصول')}
          </span>
        </div>
      </div>
    </div>
  )
}
