'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { MapPin, MessageCircle, ChevronDown, Compass } from 'lucide-react'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'
import { getCityDisplayName } from '@/lib/registration-translations'
import { Button } from '@/components/ui/button'

/**
 * Shown when the user's detected location is outside our delivery/service area.
 * Apologizes, offers Contact us link, and lets them browse by selecting a city manually.
 */
export function OutOfServiceArea() {
  const { t, lang } = useLanguage()
  const {
    detectedCityName,
    availableCities,
    setLocation,
    retryAutoDetect,
  } = useLocation()
  const [selectedCity, setSelectedCity] = useState('')
  const isRtl = lang === 'ar'

  const displayDetectedCity = detectedCityName
    ? getCityDisplayName(detectedCityName, lang)
    : ''

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`fixed inset-0 z-[400] flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-emerald-50/30 px-4 py-6 ${isRtl ? 'rtl' : 'ltr'}`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
        className="mx-auto w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8"
      >
        {/* Icon */}
        <div className="mb-5 flex justify-center">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-amber-100">
            <MapPin className="size-10 text-amber-600" aria-hidden />
          </div>
        </div>

        {/* Apology headline */}
        <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {t(
            "We're not in your area yet",
            'خدماتنا غير متوفرة في منطقتك بعد'
          )}
        </h1>

        {displayDetectedCity && (
          <p className="mt-2 text-center text-slate-600">
            {t('Detected location: ', 'الموقع المُكتشف: ')}
            <span className="font-semibold text-slate-800">
              {displayDetectedCity}
            </span>
          </p>
        )}

        <p className="mt-4 text-center text-slate-600">
          {t(
            "We're sorry — we don't deliver to your location yet. We're expanding and would love to hear from you.",
            'نأسف — لا نُوصّل إلى موقعك حالياً. نحن نوسّع نطاق الخدمة ونود أن نسمع منك.'
          )}
        </p>

        {/* Contact us – primary CTA */}
        <div className="mt-6 flex flex-col gap-3">
          <Button
            asChild
            size="lg"
            className="h-12 w-full rounded-xl bg-emerald-600 font-bold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-500"
          >
            <Link href="/contact" className="inline-flex items-center justify-center gap-2">
              <MessageCircle className="size-5" />
              {t('Contact us', 'تواصل معنا')}
            </Link>
          </Button>

          {/* Divider */}
          <div className="relative flex items-center gap-3 py-2">
            <div className="flex-1 border-t border-slate-200" />
            <span className="text-sm font-medium text-slate-400">
              {t('OR', 'أو')}
            </span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          {/* Browse anyway – city dropdown */}
          <p className="text-center text-sm font-medium text-slate-700">
            {t('I\'d still like to browse', 'أود تصفح الموقع')}
          </p>
          <div className="relative">
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-10 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              aria-label={t('Select city to browse', 'اختر المدينة للتصفح')}
            >
              <option value="">
                {t('Select a city', 'اختر مدينة')}
              </option>
              {availableCities.map((c) => (
                <option key={c} value={c}>
                  {getCityDisplayName(c, lang)}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute end-4 top-1/2 size-5 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
          </div>
          <Button
            size="lg"
            variant="outline"
            disabled={!selectedCity}
            onClick={() => selectedCity && setLocation(selectedCity)}
            className="h-12 w-full rounded-xl border-2 border-slate-200 bg-white font-bold text-slate-900 hover:bg-slate-50"
          >
            <Compass className="size-5" />
            {t('Browse this city', 'تصفح هذه المدينة')}
          </Button>
        </div>

        {/* Optional: Try again (if they denied location before) */}
        <p className="mt-5 text-center">
          <button
            type="button"
            onClick={retryAutoDetect}
            className="text-sm font-medium text-emerald-600 underline-offset-2 hover:underline"
          >
            {t('Try detecting my location again', 'إعادة تحديد موقعي')}
          </button>
        </p>
      </motion.div>
    </motion.div>
  )
}
