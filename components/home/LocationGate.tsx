'use client'

import { motion, AnimatePresence } from 'motion/react'
import { MapPin } from 'lucide-react'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'
import { LocationModal } from '@/components/global/LocationModal'
import { Button } from '@/components/ui/button'

/**
 * On first visit, shows a full-screen gate asking user to choose city.
 * Once chosen, children are shown. User can change location from header.
 */
export function LocationGate({ children }: { children: React.ReactNode }) {
  const { t, lang } = useLanguage()
  const { isChosen, setOpenLocationModal, openLocationModal } = useLocation()
  const isRtl = lang === 'ar'

  return (
    <>
      <LocationModal />

      <AnimatePresence mode="wait">
        {!isChosen ? (
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
                  className="relative z-10 h-14 w-full touch-manipulation cursor-pointer gap-2 rounded-2xl bg-emerald-600 text-lg font-bold shadow-lg shadow-emerald-500/30 hover:bg-emerald-500"
                  onClick={() => setOpenLocationModal(true)}
                  aria-label={t('Choose location', 'اختر الموقع')}
                >
                  <MapPin className="size-6" />
                  {t('Pick your area', 'اختر الموقع')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
