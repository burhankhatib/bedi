'use client'

import { useState, useEffect } from 'react'
import { MapPin, ChevronDown } from 'lucide-react'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'
import { getCityDisplayName } from '@/lib/registration-translations'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export function LocationModal() {
  const { t, lang } = useLanguage()
  const {
    openLocationModal,
    setOpenLocationModal,
    setLocation,
    availableCities,
    city: selectedCity,
  } = useLocation()

  const [city, setCity] = useState<string>(selectedCity ?? '')

  useEffect(() => {
    if (openLocationModal) {
      setCity(selectedCity ?? '')
    }
  }, [openLocationModal, selectedCity])

  const handleConfirm = () => {
    if (city) {
      setLocation(city)
    }
  }

  const isRtl = lang === 'ar'

  return (
    <Dialog open={openLocationModal} onOpenChange={setOpenLocationModal}>
      <DialogContent
        className="max-w-md rounded-2xl border-slate-200 bg-white p-6 shadow-xl sm:p-8"
        dir={isRtl ? 'rtl' : 'ltr'}
        overlayClassName="z-[350]"
        contentClassName="z-[350]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <MapPin className="size-5 text-emerald-600" />
            {t('Choose your location', 'اختر موقعك')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Select your city to see businesses near you.',
              'اختر مدينتك لرؤية الأعمال القريبة منك.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            {t('City', 'المدينة')}
          </label>
          <div className="relative">
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-10 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">{t('Select city', 'اختر المدينة')}</option>
              {availableCities.map((c) => (
                <option key={c} value={c}>
                  {getCityDisplayName(c, lang)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          </div>
          {availableCities.length === 0 && (
            <p className="mt-2 text-sm text-slate-500">
              {t('No cities with businesses yet.', 'لا توجد مدن بها أعمال حتى الآن.')}
            </p>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={() => setOpenLocationModal(false)}
          >
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500"
            onClick={handleConfirm}
            disabled={!city}
          >
            {t('Confirm', 'تأكيد')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
