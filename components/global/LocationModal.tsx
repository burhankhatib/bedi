'use client'

import { useState, useEffect } from 'react'
import { MapPin, ChevronDown, LocateFixed } from 'lucide-react'
import { useLocation } from '@/components/LocationContext'
import { useLanguage } from '@/components/LanguageContext'
import { getCityDisplayName, GEO_CITY_ALIASES } from '@/lib/registration-translations'
import { getCityFromCoordinates } from '@/lib/geofencing'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { getDeviceGeolocationPosition, isDeviceGeolocationSupported, isGeolocationUserDenied } from '@/lib/device-geolocation'

const REVERSE_GEOCODE_TIMEOUT_MS = 12_000
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
    polygons,
    city: selectedCity,
  } = useLocation()

  const [city, setCity] = useState<string>(selectedCity ?? '')
  const [isLocating, setIsLocating] = useState(false)

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

  const handleUseCurrentLocation = async () => {
    if (!isDeviceGeolocationSupported()) {
      alert(t('Geolocation is not supported by your device.', 'الموقع الجغرافي غير مدعوم في جهازك.'))
      return
    }

    setIsLocating(true)
    const locateWatchdog = window.setTimeout(() => {
      setIsLocating(false)
    }, 45_000)

    try {
      const position = await getDeviceGeolocationPosition({ enableHighAccuracy: false, timeout: 15_000, maximumAge: 0 })
      const { latitude, longitude } = position

      // 1) Try instant polygon-based geofencing first (accurate & offline)
      const geofenceCity = getCityFromCoordinates(longitude, latitude, polygons ?? undefined)
      if (geofenceCity) {
        const match = availableCities.find(c => c.toLowerCase() === geofenceCity.toLowerCase())
        if (match) {
          setCity(match)
          setLocation(match)
          clearTimeout(locateWatchdog)
          setIsLocating(false)
          return
        }
      }

      // 2) Fallback: Nominatim reverse geocoding for locations outside defined polygons
      const res = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } },
        REVERSE_GEOCODE_TIMEOUT_MS
      )
      const data = await res.json()
      const address = data.address || {}
      const addressValues: string[] = [
        address.city,
        address.town,
        address.village,
        address.municipality,
        address.suburb,
        address.county,
        address.state
      ].filter(Boolean)

      let foundCity = ''
      for (const val of addressValues) {
         const normalized = val.toLowerCase().trim()
         if (GEO_CITY_ALIASES[normalized]) {
           foundCity = GEO_CITY_ALIASES[normalized]
           break
         }
      }

      if (!foundCity && addressValues.length > 0) {
        foundCity = addressValues[0]
      }
      
      if (foundCity) {
        const match = availableCities.find(c => {
           const enMatch = c.toLowerCase() === foundCity.toLowerCase() || foundCity.toLowerCase().includes(c.toLowerCase())
           const arName = getCityDisplayName(c, 'ar')
           const arMatch = arName === foundCity || foundCity.includes(arName)
           return enMatch || arMatch
        })

        if (match) {
          setCity(match)
          setLocation(match)
        } else {
          alert(t('We could not find active businesses in your area: ', 'عذراً لا توجد أعمال نشطة في منطقتك الحالية: ') + foundCity)
        }
      } else {
         alert(t('Could not determine your city from coordinates.', 'لم نتمكن من تحديد مدينتك بدقة من الإحداثيات.'))
      }
    } catch (error) {
      console.error(error)
      if (isGeolocationUserDenied(error)) {
        alert(t('Unable to retrieve your location. Please check your permissions.', 'تعذر الوصول إلى موقعك. يرجى التحقق من الصلاحيات.'))
      } else {
        alert(t('Unable to retrieve your location.', 'تعذر الوصول إلى موقعك.'))
      }
    } finally {
      clearTimeout(locateWatchdog)
      setIsLocating(false)
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

        <div className="mt-6 flex flex-col gap-5">
          {/* Automatic Geolocation Button */}
          <Button
            variant="outline"
            className="w-full h-14 flex items-center justify-center gap-2 rounded-xl font-bold border-2 border-slate-200 text-brand-black hover:bg-slate-50 transition-colors shadow-sm"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
          >
            {isLocating ? (
              <span className="flex items-center gap-2">
                <div className="size-5 animate-spin rounded-full border-2 border-brand-black border-t-transparent" />
                {t('Locating...', 'جاري تحديد الموقع...')}
              </span>
            ) : (
              <>
                <LocateFixed className="size-5 text-brand-red" />
                {t('Use Current Location', 'استخدام موقعي الحالي')}
              </>
            )}
          </Button>

          {/* Divider */}
          <div className="relative flex items-center gap-4 py-2">
            <div className="flex-1 border-t border-slate-200" />
            <span className="text-sm font-bold text-slate-400">{t('OR', 'أو')}</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              {t('Search/Select City', 'اختر المدينة')}
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
            <ChevronDown className="pointer-events-none absolute end-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          </div>
          {availableCities.length === 0 && (
            <p className="mt-2 text-sm text-slate-500">
              {t('No cities with businesses yet.', 'لا توجد مدن بها أعمال حتى الآن.')}
            </p>
          )}
          </div>
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
