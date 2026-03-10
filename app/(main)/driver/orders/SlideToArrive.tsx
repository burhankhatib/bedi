'use client'

import { useRef, useState, useLayoutEffect } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'

type Props = {
  orderId: string
  onArrive: (orderId: string) => Promise<void>
  /** When false, slider is grayed out and not slideable (driver not within 100m). */
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
  const progressWidth = useTransform(progress, (v) => `${Math.min(1, v) * 100}%`)

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

  const isDisabled = disabled || isArriving || isDone

  return (
    <div className="mt-3" dir="ltr">
      <p className="text-base text-blue-400/90 mb-2 text-right font-medium">
        {t('Slide to confirm arrival', 'اسحب لتأكيد الوصول')}
      </p>
      <div
        ref={trackRef}
        className={`relative w-full rounded-xl border overflow-hidden touch-none transition-colors duration-200 ${
          isDisabled
            ? 'bg-slate-800/60 border-slate-600 cursor-not-allowed'
            : 'bg-blue-900/60 border-blue-600'
        }`}
        style={{ height: TRACK_HEIGHT }}
      >
        <motion.div
          className={`absolute left-1.5 top-1/2 -translate-y-1/2 rounded-xl flex items-center justify-center shadow-lg z-10 ${
            isDisabled
              ? 'bg-slate-600 cursor-not-allowed pointer-events-none'
              : 'bg-blue-500 cursor-grab active:cursor-grabbing'
          }`}
          style={{
            width: THUMB_SIZE,
            height: TRACK_HEIGHT - PADDING,
            x,
          }}
          drag={isDisabled ? false : 'x'}
          dragConstraints={{ left: 0, right: maxDrag }}
          dragElastic={0}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
        >
          <MapPin className={`h-8 w-8 shrink-0 ${isDisabled ? 'text-slate-400' : 'text-white'}`} />
        </motion.div>
        {!isDisabled && (
          <motion.div
            className="absolute inset-y-0 left-0 rounded-l-xl bg-blue-600/50 pointer-events-none"
            style={{ width: progressWidth }}
          />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center pr-4 pl-4 pointer-events-none">
          {isDisabled && !isDone ? (
            <span className="text-sm font-bold text-slate-500 text-center">
              {t('You have not yet arrived at the customer!', 'أنت لم تصل بعد إلى الزبون!')}
            </span>
          ) : (
            <span className={`text-base font-bold ${isDisabled ? 'text-slate-400' : 'text-blue-200'}`}>
              {isArriving ? '...' : isDone ? t('Arrived!', 'وصلت!') : t('Slide to confirm arrival', 'اسحب لتأكيد الوصول')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
