'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLanguage } from '@/components/LanguageContext'
import { formatCurrency } from '@/lib/currency'

const TIP_CELEBRATION_DURATION_MS = 10_000

interface TipCelebrationModalProps {
  tipAmount: number
  currency: string
  onClose: () => void
}

export function TipCelebrationModal({ tipAmount, currency, onClose }: TipCelebrationModalProps) {
  const { t } = useLanguage()

  useEffect(() => {
    const id = setTimeout(onClose, TIP_CELEBRATION_DURATION_MS)
    return () => clearTimeout(id)
  }, [onClose])

  const fmtCurrency = formatCurrency(currency)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 shadow-2xl shadow-emerald-900/40 overflow-hidden"
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white/5" />
        </div>

        <div className="relative px-6 py-8 text-center">
          {/* Emoji celebration */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 15 }}
            className="text-6xl mb-4"
            aria-hidden
          >
            🎉💚
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            className="text-xl font-black text-white drop-shadow-md"
          >
            {t('You received a tip!', 'استلمت إكرامية!')}
          </motion.h2>

          {/* Encouraging subtitle */}
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.25 }}
            className="text-white/95 text-sm font-medium mt-2 leading-relaxed"
          >
            {t('Your customer appreciates your great service!', 'العميل يقدر خدمتك المميزة!')}
          </motion.p>

          {/* Tip amount - prominent */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.25, type: 'spring', stiffness: 350, damping: 18 }}
            className="mt-5 rounded-2xl bg-white/20 backdrop-blur-sm px-6 py-4 border border-white/30"
          >
            <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">
              {t('Tip amount', 'مبلغ الإكرامية')}
            </p>
            <p className="text-3xl font-black text-white tabular-nums mt-0.5">
              +{tipAmount.toFixed(2)} {fmtCurrency}
            </p>
          </motion.div>

          {/* Close button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            type="button"
            onClick={onClose}
            className="mt-6 w-full py-3.5 rounded-2xl font-bold text-sm bg-white/25 hover:bg-white/35 text-white border border-white/40 transition-colors"
          >
            {t('Thanks!', 'شكراً!')}
          </motion.button>

          <p className="text-white/60 text-[10px] mt-2">
            {t('Closes automatically in 10 seconds', 'يُغلق تلقائياً خلال 10 ثوانٍ')}
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
