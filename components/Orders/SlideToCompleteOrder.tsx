'use client'

import { useRef, useState, useLayoutEffect } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'

const TRACK_HEIGHT = 52
const THUMB_SIZE = 44
const THRESHOLD = 0.82

const labelEn = 'Slide to complete'
const labelAr = 'اسحب للإكمال'
const completedEn = 'Completed'
const completedAr = 'تم'

type Props = {
  onComplete: () => Promise<void>
  disabled?: boolean
}

export function SlideToCompleteOrder({ onComplete, disabled }: Props) {
  const { lang } = useLanguage()
  const t = lang === 'ar' ? labelAr : labelEn
  const tDone = lang === 'ar' ? completedAr : completedEn
  const trackRef = useRef<HTMLDivElement>(null)
  const [maxDrag, setMaxDrag] = useState(240)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const x = useMotionValue(0)

  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    const update = () => setMaxDrag(Math.max(0, el.offsetWidth - THUMB_SIZE - 12))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const progress = useTransform(x, [0, maxDrag], [0, 1])

  const handleDragEnd = () => {
    if (disabled || isCompleting || isDone) return
    const current = x.get()
    if (current >= maxDrag * THRESHOLD) {
      setIsCompleting(true)
      onComplete()
        .then(() => setIsDone(true))
        .catch(() => {})
        .finally(() => setIsCompleting(false))
    }
  }

  return (
    <div className="mt-2" dir="ltr">
      <p className="text-sm text-green-600 font-semibold mb-1.5">{t}</p>
      <div
        ref={trackRef}
        className="relative w-full rounded-xl bg-green-100 border-2 border-green-500 overflow-hidden touch-none"
        style={{ height: TRACK_HEIGHT }}
      >
        <motion.div
          className="absolute left-1.5 top-1.5 rounded-lg bg-green-500 flex items-center justify-center shadow-lg z-10 cursor-grab active:cursor-grabbing"
          style={{
            width: THUMB_SIZE,
            height: TRACK_HEIGHT - 12,
            x,
          }}
          drag="x"
          dragConstraints={{ left: 0, right: maxDrag }}
          dragElastic={0}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
        >
          <CheckCircle2 className="h-6 w-6 text-white" />
        </motion.div>
        <motion.div
          className="absolute inset-y-0 left-0 rounded-l-xl bg-green-500/40 pointer-events-none"
          style={{
            width: useTransform(progress, (v) => `${Math.min(1, v) * 100}%`),
          }}
        />
        <div className="absolute inset-0 flex items-center justify-end pr-3 pointer-events-none">
          <span className="text-sm font-bold text-green-800">
            {isCompleting ? '...' : isDone ? tDone : t}
          </span>
        </div>
      </div>
    </div>
  )
}
