'use client'

import { motion, AnimatePresence } from 'motion/react'
import { MapPin, Loader2 } from 'lucide-react'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'
import { LocationModal } from '@/components/global/LocationModal'
import { OutOfServiceArea } from '@/components/home/OutOfServiceArea'
import { Button } from '@/components/ui/button'

/**
 * On first visit, tries to auto-detect location. If in service area, skips modal.
 * If out of service, shows OutOfServiceArea (apology + Contact + browse by city).
 * If denied/error or no geolocation, shows gate to pick location manually.
 */
export function LocationGate({ children }: { children: React.ReactNode }) {
  const { t, lang } = useLanguage()
  const {
    isChosen,
    setOpenLocationModal,
    openLocationModal,
    locationStatus,
  } = useLocation()
  const isRtl = lang === 'ar'

  // In service or user chose a city → show app
  if (isChosen) {
    return (
      <>
        <LocationModal />
        {children}
      </>
    )
  }

  // Auto-detecting → show brief loading so we don't flash "Where are you?" first
  if (locationStatus === 'detecting') {
    return (
      <>
        <LocationModal />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className={`fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-white to-emerald-50/40 px-6 ${openLocationModal ? 'z-0' : 'z-[400]'}`}
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <div className="flex max-w-md flex-col items-center gap-4 rounded-3xl border border-emerald-100 bg-white/90 p-6 text-center shadow-[0_10px_30px_rgba(16,185,129,0.12)]">
            <Loader2 className="size-10 animate-spin text-emerald-600" aria-hidden />
            <p className="text-center text-slate-600">
              {t('Detecting your location...', 'جاري تحديد موقعك...')}
            </p>
            <p className="text-sm text-slate-500">
              {t(
                "If this takes too long, you can choose your city manually.",
                'إذا استغرق هذا وقتاً طويلاً، يمكنك اختيار مدينتك يدوياً.'
              )}
            </p>
            <div className="mt-2 w-full">
              <Button
                type="button"
                size="lg"
                onClick={() => setOpenLocationModal(true)}
                className="h-11 w-full rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-500"
              >
                <MapPin className="size-5" />
                {t('Choose city manually', 'اختيار المدينة يدوياً')}
              </Button>
            </div>
          </div>
        </motion.div>
      </>
    )
  }

  // Out of service area → show apology, Contact link, and browse-by-city
  if (locationStatus === 'out_of_service') {
    return (
      <>
        <LocationModal />
        <OutOfServiceArea />
      </>
    )
  }

  // Denied / error / idle: show "Where are you?" gate and open modal on button click
  return (
    <>
      <LocationModal />
      <AnimatePresence mode="wait">
        <motion.div
          key="gate"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={`fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-white to-emerald-50/40 px-6 ${openLocationModal ? 'z-0' : 'z-[420]'}`}
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="mx-auto w-full max-w-md rounded-[28px] border border-emerald-100 bg-white/95 p-7 text-center shadow-[0_10px_30px_rgba(16,185,129,0.15)] backdrop-blur-sm"
          >
            <div className="mb-5 flex justify-center">
              <div className="flex size-24 items-center justify-center rounded-3xl bg-emerald-100/80">
                <MapPin className="size-11 text-emerald-600" />
              </div>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              {t('Where are you?', 'أين أنت؟')}
            </h1>
            <p className="mt-3 text-base text-slate-600">
              {t(
                'Choose your city to instantly see nearby restaurants, stores, and delivery options.',
                'اختر مدينتك الآن لترى المطاعم والمتاجر وخيارات التوصيل القريبة فوراً.'
              )}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {t(
                'Tip: you can change it anytime from the top menu.',
                'ملاحظة: يمكنك تغييرها لاحقاً في أي وقت من القائمة العلوية.'
              )}
            </p>
            <div className="mt-8">
              <Button
                type="button"
                size="lg"
                className="relative z-10 h-14 w-full touch-manipulation cursor-pointer gap-2 rounded-2xl bg-emerald-600 text-lg font-bold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-500"
                onClick={() => setOpenLocationModal(true)}
                aria-label={t('Choose location', 'اختر الموقع')}
              >
                <MapPin className="size-6" />
                {t('Pick your area', 'اختر الموقع')}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  )
}
