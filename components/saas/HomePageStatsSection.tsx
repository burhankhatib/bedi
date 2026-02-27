'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { animate } from 'motion'
import {
  Store,
  Package,
  Truck,
  MapPin,
  Globe,
  ShoppingBag,
} from 'lucide-react'
import type { HomePageStats } from '@/lib/home-stats'

type Lang = 'ar' | 'en'

function formatStat(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

/** Animates from 0 on mount; when value changes (e.g. live update), animates from current to new value. */
function AnimatedNumber({
  value,
  initialDuration = 1.2,
  initialDelay = 0,
  updateDuration = 0.6,
}: {
  value: number
  initialDuration?: number
  initialDelay?: number
  updateDuration?: number
}) {
  const [display, setDisplay] = useState(0)
  const displayRef = useRef(0)
  const isFirstMount = useRef(true)

  useEffect(() => {
    const update = (v: number) => {
      const n = Math.round(v)
      displayRef.current = n
      setDisplay(n)
    }

    if (isFirstMount.current) {
      isFirstMount.current = false
      const controls = animate(0, value, {
        duration: initialDuration,
        delay: initialDelay,
        ease: [0.22, 0.61, 0.36, 1],
        onUpdate: update,
      })
      return () => controls.stop()
    }

    const from = displayRef.current
    const controls = animate(from, value, {
      duration: updateDuration,
      ease: [0.22, 0.61, 0.36, 1],
      onUpdate: update,
    })
    return () => controls.stop()
  }, [value, initialDuration, initialDelay, updateDuration])

  return <span>{formatStat(display)}</span>
}

const STAT_KEYS: (keyof HomePageStats)[] = [
  'businesses',
  'productsSold',
  'drivers',
  'cities',
  'countries',
  'orders',
]

const STAT_META: Record<
  keyof HomePageStats,
  { icon: typeof Store; labelEn: string; labelAr: string }
> = {
  businesses: {
    icon: Store,
    labelEn: 'Businesses on Bedi',
    labelAr: 'أعمال على Bedi',
  },
  productsSold: {
    icon: Package,
    labelEn: 'Products sold',
    labelAr: 'منتجات مباعة',
  },
  drivers: {
    icon: Truck,
    labelEn: 'Drivers',
    labelAr: 'سائقون',
  },
  cities: {
    icon: MapPin,
    labelEn: 'Cities active',
    labelAr: 'مدن نشطة',
  },
  countries: {
    icon: Globe,
    labelEn: 'Countries',
    labelAr: 'دول',
  },
  orders: {
    icon: ShoppingBag,
    labelEn: 'Orders (approx.)',
    labelAr: 'طلبات (تقريبي)',
  },
}

export type HomePageStatsSectionProps = {
  stats: HomePageStats
  /** Translation helper from parent: t('English', 'العربية') */
  t: (en: string, ar: string) => string
  lang: Lang
}

export function HomePageStatsSection({ stats: initialStats, t, lang }: HomePageStatsSectionProps) {
  // Static stats from page load. Live SSE removed to reduce Sanity API usage.
  // Tenants/Drivers/Orders pages keep their real-time updates.
  const [stats] = useState<HomePageStats>(initialStats)

  return (
    <section
      id="stats"
      className="relative overflow-hidden border-b border-slate-800/50 py-16 md:py-24"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_50%,rgba(245,158,11,0.06),transparent)]" />
      <div className="container relative mx-auto px-4">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-bold md:text-3xl">
            {t('Bedi in numbers', 'Bedi بالأرقام')}
          </h2>
          <p className="mt-3 text-slate-400">
            {t(
              'Join thousands of businesses and drivers already on the platform.',
              'انضم إلى آلاف الأعمال والسائقين على المنصة.'
            )}
          </p>
        </motion.div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {STAT_KEYS.map((key, i) => {
            const { icon: Icon, labelEn, labelAr } = STAT_META[key]
            return (
              <motion.div
                key={key}
                className="flex flex-col items-center rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 text-center transition-colors hover:border-amber-500/30 hover:bg-slate-900/60"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{
                  duration: 0.45,
                  delay: i * 0.08,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
              >
                <motion.div
                  className="mb-4 flex size-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    type: 'spring',
                    stiffness: 200,
                    damping: 18,
                    delay: i * 0.08 + 0.15,
                  }}
                >
                  <Icon className="size-6" />
                </motion.div>
                <div className="text-3xl font-bold tabular-nums text-white md:text-4xl">
                  <AnimatedNumber
                    value={stats[key]}
                    initialDuration={1.4}
                    initialDelay={0.2 + i * 0.1}
                    updateDuration={0.6}
                  />
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  {lang === 'ar' ? labelAr : labelEn}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
