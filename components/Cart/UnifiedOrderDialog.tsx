'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/LanguageContext'
import { toEnglishDigits } from '@/lib/phone'
import { Store, UtensilsCrossed, Truck, User, MapPin, Phone, Locate, Check, Loader2, Link, Edit2, Map as MapIcon } from 'lucide-react'
import { useCart, OrderType } from './CartContext'
import { parseCoordsFromGoogleMapsUrl } from '@/lib/maps-utils'
import { useLocation } from '@/components/LocationContext'
import { getCityCenter } from '@/lib/geofencing'
import { isWithinShift, getTodaysHours, isWithinHours, getTimeZoneForCountry } from '@/lib/business-hours'
import { getShopperFeeByItemCount, getShopperFeeExplanation } from '@/lib/shopper-fee'
import { formatCurrency } from '@/lib/currency'
import { getDeviceGeolocationPosition, isDeviceGeolocationSupported, watchDeviceGeolocation, clearDeviceGeolocationWatch, WatchGeolocationId, isGeolocationUserDenied } from '@/lib/device-geolocation'

const LocationPickerMap = dynamic(() => import('./LocationPickerMap'), { 
  ssr: false, 
  loading: () => <div className="h-full w-full bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div> 
})

interface UnifiedOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReceiveInPersonSubmit: (name: string, phone: string, scheduledFor?: string) => void
  onDineInSubmit: (name: string, table: string, phone: string, scheduledFor?: string) => void
  onDeliverySubmit: (
    name: string,
    phone: string,
    address: string,
    deliveryFee: number,
    scheduledFor?: string,
    deliveryFeePaidByBusiness?: boolean
  ) => void
  initialName?: string
  /** Prefill phone from Clerk verified phone so user does not re-enter */
  initialPhone?: string
  /** Tenant slug (e.g. from /t/[slug]) so delivery areas are loaded for this tenant */
  tenantSlug?: string | null
  /** When false, only show "Receive in Person" and "Delivery" (no Dine-in). Default true for backward compat. */
  supportsDineIn?: boolean
  /** When false, hide "Receive in Person" (pickup) option. Default true. */
  supportsReceiveInPerson?: boolean
  /** When true, show Delivery option (tenant has delivery enabled and has areas). When false, hide. When undefined, fall back to tenantSlug + areas fetch for backward compat. */
  hasDelivery?: boolean
  /** When set (customer scanned table QR), lock Dine-in and pre-fill table number; table field is read-only. */
  lockedTableNumber?: string | null
  /** Optional: shared delivery location (from "Share my location"). Used to show status and clear on reset. */
  deliveryLat?: number | null
  deliveryLng?: number | null
  setDeliveryLocation?: (lat: number, lng: number, accuracyMeters?: number | null, source?: 'gps_high' | 'gps_low' | 'manual_picker' | 'maps_link' | 'cache') => void
  clearDeliveryLocation?: () => void
}

export function UnifiedOrderDialog({
  open,
  onOpenChange,
  onReceiveInPersonSubmit,
  onDineInSubmit,
  onDeliverySubmit,
  initialName = '',
  initialPhone = '',
  tenantSlug,
  supportsDineIn = true,
  supportsReceiveInPerson = true,
  hasDelivery,
  lockedTableNumber = null,
  deliveryLat = null,
  deliveryLng = null,
  setDeliveryLocation,
  clearDeliveryLocation,
}: UnifiedOrderDialogProps) {
  const isTableLocked = Boolean(lockedTableNumber)
  const { t, lang } = useLanguage()
  const { cartTenant, items, totalItems } = useCart()
  
  // Call useLocation unconditionally. If it might throw (not in provider), we need a wrapper, 
  // but since CartContext is already inside LocationProvider in this app, it's safe.
  const locationCtx = useLocation()
  const cityStr = locationCtx?.city || ''

  const fallbackCenter = useMemo(() => (cityStr ? getCityCenter(cityStr) : null), [cityStr])
  const mapLat = deliveryLat ?? fallbackCenter?.lat ?? 31.7804
  const mapLng = deliveryLng ?? fallbackCenter?.lng ?? 35.2570

  /** Business is closed (manual or by schedule). When true, only scheduling is allowed at checkout. */
  const effectiveClosed = useMemo(() => {
    if (!cartTenant) return false
    const isManuallyClosed = cartTenant.isManuallyClosed === true
    if (isManuallyClosed) return true
    const tz = getTimeZoneForCountry(cartTenant.businessCountry ?? null)
    const todaysHours = getTodaysHours(cartTenant.openingHours ?? null, cartTenant.customDateHours ?? null, tz)
    const hasSchedule = (cartTenant.openingHours ?? []).some((d: { open?: string; close?: string }) => d?.open || d?.close)
    return hasSchedule && !isWithinHours(todaysHours, tz)
  }, [cartTenant])

  const [step, setStep] = useState<'type' | 'details'>(lockedTableNumber ? 'details' : 'type')
  const [orderType, setOrderType] = useState<OrderType | null>(lockedTableNumber ? 'dine-in' : null)

  const [isEditingName, setIsEditingName] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  const [showLocationControls, setShowLocationControls] = useState(false)

  // Timing
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledFor, setScheduledFor] = useState('')

  // Form fields
  const [name, setName] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  const [loading, setLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [mapsLinkInput, setMapsLinkInput] = useState('')
  const [mapsLinkError, setMapsLinkError] = useState<string | null>(null)

  const isDistanceMode = true
  const showDeliveryOption = hasDelivery === true || (hasDelivery == null && tenantSlug)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const prevOpenRef = useRef(false)
  /** Prevents overlapping getCurrentPosition calls (auto + tap, or double-tap). */
  const geoInFlightRef = useRef(false)
  /** One automatic GPS attempt per dialog open on the delivery step (reset when modal opens). */
  const autoDeliveryGeoRef = useRef(false)

  const [distanceFee, setDistanceFee] = useState<number | null>(null)
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)
  const [tenantDeliveryFlags, setTenantDeliveryFlags] = useState<{
    requiresPersonalShopper: boolean
    supportsDriverPickup: boolean
    freeDeliveryEnabled: boolean
  } | null>(null)

  // Fetch distance price when location changes
  useEffect(() => {
    if (orderType !== 'delivery' || !tenantSlug) return
    const hasLocation = isDistanceMode && deliveryLat != null && deliveryLng != null
    if (!hasLocation) {
      setDistanceFee(null)
      setDistanceKm(null)
      setPriceLoading(false)
    } else {
      setPriceLoading(true)
    }
    const ac = new AbortController()
    const params = hasLocation ? `?lat=${deliveryLat}&lng=${deliveryLng}` : ''
    fetch(`/api/tenants/${tenantSlug}/delivery-price${params}`, { signal: ac.signal })
      .then(res => res.json())
      .then(data => {
        if (hasLocation && data.suggestedFee !== undefined) {
          setDistanceFee(data.suggestedFee)
          setDistanceKm(data.distanceKm)
        }
        setTenantDeliveryFlags({
          requiresPersonalShopper: data.requiresPersonalShopper === true,
          supportsDriverPickup: data.supportsDriverPickup === true,
          freeDeliveryEnabled: data.freeDeliveryEnabled === true,
        })
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('Failed to fetch delivery price', err)
      })
      .finally(() => {
        if (hasLocation) setPriceLoading(false)
      })
    return () => ac.abort()
  }, [orderType, isDistanceMode, tenantSlug, deliveryLat, deliveryLng])

  // Reset form only when dialog transitions from closed to open (not when location/callbacks update while open)
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current
    prevOpenRef.current = open
    if (justOpened) {
      setStep(lockedTableNumber ? 'details' : 'type')
      setName(initialName || t('Guest', 'ضيف'))
      setOrderType(lockedTableNumber ? 'dine-in' : null)
      setTableNumber(lockedTableNumber ?? '')
      setPhone(initialPhone)
      setAddress('')
      setIsScheduled(effectiveClosed)
      setScheduledFor('')
      setLocationError(null)
      setMapsLinkInput('')
      setMapsLinkError(null)
      setIsEditingName(false)
      setShowMapModal(false)
      setShowNotes(false)
      autoDeliveryGeoRef.current = false
      clearDeliveryLocation?.()
    } else if (open && !isEditingName && initialName && name === t('Guest', 'ضيف')) {
      // If the modal is already open but the initialName just loaded from Clerk, update it
      setName(initialName)
    }
  }, [open, initialName, initialPhone, clearDeliveryLocation, lockedTableNumber, t, isEditingName, name, effectiveClosed])

  const handleNameNext = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (lockedTableNumber) {
      setOrderType('dine-in')
      setTableNumber(lockedTableNumber)
      setStep('details')
    } else {
      setStep('type')
    }
  }

  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

  /** Reverse geocode (lat,lng) → friendly display name via Nominatim. Returns null on failure. */
  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string | null> => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=${lang === 'ar' ? 'ar' : 'en'}`)
      const data = await res.json()
      if (data?.address) {
        const parts = []
        if (data.address.road || data.address.pedestrian || data.address.street) parts.push(data.address.road || data.address.pedestrian || data.address.street)
        if (data.address.neighbourhood || data.address.suburb || data.address.quarter) parts.push(data.address.neighbourhood || data.address.suburb || data.address.quarter)
        if (data.address.city || data.address.town || data.address.village) parts.push(data.address.city || data.address.town || data.address.village)
        
        const uniqueParts = Array.from(new Set(parts)).filter(Boolean)
        if (uniqueParts.length > 0) return uniqueParts.join(lang === 'ar' ? '، ' : ', ')
      }
      if (data?.display_name) {
        const parts = data.display_name.split(',').map((p: string) => p.trim())
        if (parts.length > 1) parts.pop() // Try to remove country
        return parts.join(lang === 'ar' ? '، ' : ', ')
      }
    } catch {
      // ignore
    }
    return null
  }, [lang])

  const requestDeliveryLocation = useCallback(
    async (opts?: { highAccuracy?: boolean }) => {
      if (!setDeliveryLocation || !isDeviceGeolocationSupported()) {
        if (!isDeviceGeolocationSupported()) {
          setLocationError(t('Location is not supported by your browser.', 'المتصفح لا يدعم الموقع.'))
        }
        return
      }
      if (geoInFlightRef.current) return

      geoInFlightRef.current = true
      setLocationError(null)
      setLocationLoading(true)

      const highAccuracy = opts?.highAccuracy === true

      let watchId: WatchGeolocationId | null = null
      let fallbackTimeoutId: number | null = null

      const cleanup = () => {
        if (watchId !== null) clearDeviceGeolocationWatch(watchId)
        if (fallbackTimeoutId !== null) window.clearTimeout(fallbackTimeoutId)
        geoInFlightRef.current = false
        setLocationLoading(false)
      }

      const applyFix = (pos: { coords: { latitude: number; longitude: number; accuracy?: number | null } }) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const accuracy = pos.coords.accuracy ?? null
        
        console.debug(`[GPS] Applied fix: accuracy ${accuracy}m`)
        setDeliveryLocation(lat, lng, accuracy, highAccuracy ? 'gps_high' : 'gps_low')
        
        void reverseGeocode(lat, lng).then((name) => {
          if (name) setAddress((prev) => (prev.trim() ? prev : name))
        })
      }

      const handleError = (err: any) => {
        cleanup()
        if (isGeolocationUserDenied(err)) {
          setLocationError(
            isIOS
              ? t(
                  'Location was denied. On iPhone: go to Settings > Privacy & Security > Location Services, turn on and set this website to "Ask" or "While Using". Then tap the button again.',
                  'تم رفض الموقع. على iPhone: الإعدادات > الخصوصية والأمان > خدمات الموقع، فعّلها واختر لهذا الموقع "اسأل" أو "أثناء الاستخدام". ثم اضغط الزر مرة أخرى.'
                )
              : t(
                  'Location was denied. Enable it in your browser or device Settings (Privacy > Location), then tap the button again.',
                  'تم رفض الموقع. فعّله من إعدادات المتصفح أو الجهاز (الخصوصية > الموقع)، ثم اضغط الزر مرة أخرى.'
                )
          )
        } else if (err?.code === 3) {
          setLocationError(
            t(
              'Location request timed out. Try again or enter your address below.',
              'انتهت مهلة طلب الموقع. حاول مرة أخرى أو أدخل عنوانك أدناه.'
            )
          )
        } else {
          setLocationError(
            t(
              'Could not get location. Allow access when prompted, or enter your address below.',
              'تعذر الحصول على الموقع. اسمح بالوصول عند الطلب، أو أدخل عنوانك أدناه.'
            )
          )
        }
      }

      // Watchdog timer to ensure we never get stuck in "Loading" state
      const maxTimeoutMs = highAccuracy ? 20000 : 15000
      fallbackTimeoutId = window.setTimeout(() => {
        handleError({ code: 3 }) // Simulate timeout
      }, maxTimeoutMs)

      if (!highAccuracy) {
        // Standard first-pass: direct getCurrentPosition, more reliable on Android for prompting
        try {
          const pos = await getDeviceGeolocationPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 0 })
          cleanup()
          applyFix({ coords: { latitude: pos.latitude, longitude: pos.longitude, accuracy: pos.accuracy } })
        } catch (err) {
          handleError(err)
        }
      } else {
        // High accuracy pass: use watchPosition for a short window to find a better fix
        let bestFix: { coords: { latitude: number; longitude: number; accuracy: number } } | null = null
        let samplingTimeoutId: number | null = null

        const finishHighAccuracy = () => {
          if (samplingTimeoutId !== null) window.clearTimeout(samplingTimeoutId)
          cleanup()
          if (bestFix) {
            applyFix(bestFix)
          } else {
            handleError({ code: 3 })
          }
        }

        const onPosition = (pos: { latitude: number; longitude: number; accuracy?: number | null }) => {
          const accuracy = pos.accuracy ?? Infinity
          const bestAcc = bestFix?.coords.accuracy ?? Infinity
          if (!bestFix || accuracy < bestAcc) {
            bestFix = { coords: { latitude: pos.latitude, longitude: pos.longitude, accuracy } }
          }
          if (accuracy <= 25) {
            finishHighAccuracy()
          }
        }

        samplingTimeoutId = window.setTimeout(() => {
          finishHighAccuracy()
        }, 8000)

        try {
          watchId = await watchDeviceGeolocation(
            onPosition,
            (err) => {
              if (bestFix) {
                finishHighAccuracy()
              } else {
                if (samplingTimeoutId !== null) window.clearTimeout(samplingTimeoutId)
                handleError(err)
              }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
          )
        } catch (err) {
          handleError(err)
        }
      }
    },
    [setDeliveryLocation, t, isIOS, reverseGeocode]
  )

  const handleMapsLinkChange = async (value: string) => {
    setMapsLinkInput(value)
    setMapsLinkError(null)
    if (!value.trim()) return
    const coords = parseCoordsFromGoogleMapsUrl(value.trim())
    if (coords && setDeliveryLocation) {
      setDeliveryLocation(coords.lat, coords.lng, null, 'maps_link')
      setMapsLinkError(null)
      const name = await reverseGeocode(coords.lat, coords.lng)
      if (name) setAddress(name)
    } else if (value.trim().length > 10) {
      setMapsLinkError(
        t('Could not read location from this link. Try copying the link from Google Maps → Share → Copy link.', 'تعذر قراءة الموقع من هذا الرابط. جرب نسخ الرابط من Google Maps ← مشاركة ← نسخ الرابط.')
      )
    }
  }

  const handleTypeSelection = (type: OrderType) => {
    if (type === 'receive-in-person') {
      setOrderType('receive-in-person')
      setStep('details')
      return
    }
    setOrderType(type)
    setStep('details')
  }

  // Auto-detect delivery pin once when the delivery details step is shown (after choosing Delivery).
  useLayoutEffect(() => {
    if (!open || step !== 'details' || orderType !== 'delivery' || !setDeliveryLocation) return
    if (deliveryLat != null && deliveryLng != null) return
    if (autoDeliveryGeoRef.current) return
    autoDeliveryGeoRef.current = true
    requestDeliveryLocation() 
  }, [open, step, orderType, setDeliveryLocation, deliveryLat, deliveryLng, requestDeliveryLocation])

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const finalScheduledFor = isScheduled && scheduledFor ? new Date(scheduledFor).toISOString() : undefined

    if (orderType === 'receive-in-person') {
      if (name.trim() && phone.trim()) {
        onReceiveInPersonSubmit(name.trim(), phone.trim(), finalScheduledFor)
        onOpenChange(false)
      }
    } else if (orderType === 'dine-in') {
      const dineInScheduled = (isScheduled || effectiveClosed) && scheduledFor ? new Date(scheduledFor).toISOString() : undefined
      if (name.trim() && tableNumber.trim() && phone.trim() && (!effectiveClosed || dineInScheduled)) {
        onDineInSubmit(name.trim(), tableNumber.trim(), phone.trim(), dineInScheduled)
        onOpenChange(false)
      }
    } else if (orderType === 'delivery') {
      const deliveryFeeValue = distanceFee ?? 0
      const hasSharedLocation = deliveryLat != null && deliveryLng != null
      if (!hasSharedLocation) {
        setLocationError(
          t(
            'Please enable location sharing before continuing with delivery.',
            'يرجى تفعيل مشاركة الموقع قبل متابعة طلب التوصيل.'
          )
        )
        return
      }

      if (name.trim() && phone.trim()) {
        const addressValue = address.trim() || (hasSharedLocation ? t('Location shared', 'تم مشاركة الموقع') : '')
        onDeliverySubmit(
          name.trim(),
          phone.trim(),
          addressValue,
          deliveryFeeValue,
          finalScheduledFor,
          tenantDeliveryFlags?.freeDeliveryEnabled === true
        )
        onOpenChange(false)
      }
    }
  }

  const handleBack = () => {
    if (step === 'details') {
      if (lockedTableNumber) {
        onOpenChange(false)
      } else {
        autoDeliveryGeoRef.current = false
        setStep('type')
        setOrderType(null)
      }
    } else if (step === 'type') {
      onOpenChange(false)
    }
  }

  const getMinDateTime = () => {
    const nowLocal = new Date()
    nowLocal.setMinutes(nowLocal.getMinutes() - nowLocal.getTimezoneOffset())
    return nowLocal.toISOString().slice(0, 16)
  }

  const validateScheduleTime = (dateTimeStr: string): string | null => {
    if (!dateTimeStr || !cartTenant?.openingHours) return null;
    
    const selectedDate = new Date(dateTimeStr);
    if (isNaN(selectedDate.getTime())) return null;

    // Minimum is now + 45 minutes
    const minTime = new Date();
    minTime.setMinutes(minTime.getMinutes() + 45);
    if (selectedDate < minTime) {
      return t('Please select a time at least 45 minutes from now.', 'يرجى اختيار وقت بعد 45 دقيقة على الأقل من الآن.');
    }

    const dayIndex = selectedDate.getDay(); // 0 = Sunday, 6 = Saturday
    const dayHours = cartTenant.openingHours[dayIndex];
    
    if (!dayHours) return null;

    const selectedMins = selectedDate.getHours() * 60 + selectedDate.getMinutes();

    // Helper to convert HH:mm to minutes
    const toMins = (hm: string | undefined) => {
      if (!hm || !/^\d{1,2}:\d{2}$/.test(hm)) return -1;
      const [h, m] = hm.split(':').map(Number);
      return h * 60 + m;
    };

    // Check if the business is completely closed on this day
    const hasHours = (dayHours.open && dayHours.close) || (dayHours.shifts && dayHours.shifts.length > 0);
    if (!hasHours) {
      return t('Business is closed on this day.', 'المتجر مغلق في هذا اليوم.');
    }

    // Check against shifts or main hours
    let isValid = false;
    let availableTimesText = '';

    const checkShift = (open?: string, close?: string) => {
      const openMins = toMins(open);
      const closeMins = toMins(close);
      if (openMins < 0 || closeMins < 0) return;

      // Add 45 min prep time to opening, subtract 45 min from closing
      const minAllowed = openMins + 45;
      const maxAllowed = closeMins > openMins ? closeMins - 45 : (closeMins + 24 * 60) - 45;

      if (selectedMins >= minAllowed && selectedMins <= maxAllowed) {
        isValid = true;
      }

      // Format for error message
      const formatTime = (mins: number) => {
        const h = Math.floor(mins / 60) % 24;
        const m = mins % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      };
      
      if (availableTimesText) availableTimesText += ' / ';
      availableTimesText += `${formatTime(minAllowed)} - ${formatTime(maxAllowed)}`;
    };

    // Always check main hours if they exist
    if (dayHours.open && dayHours.close) {
      checkShift(dayHours.open, dayHours.close);
    }
    
    // Also check any extra shifts
    if (dayHours.shifts && dayHours.shifts.length > 0) {
      dayHours.shifts.forEach((s: any) => checkShift(s.open, s.close));
    }

    if (!isValid) {
      return t(`Available ordering times for this day: ${availableTimesText}`, `أوقات الطلب المتاحة لهذا اليوم: ${availableTimesText}`);
    }

    return null;
  }

  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Re-validate when time changes (including when effectiveClosed and dine-in)
  useEffect(() => {
    if ((isScheduled || effectiveClosed) && scheduledFor) {
      setScheduleError(validateScheduleTime(scheduledFor));
    } else {
      setScheduleError(null);
    }
  }, [isScheduled, effectiveClosed, scheduledFor, cartTenant?.openingHours]);

  const customerInfoHeader = (
    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6">
      <div className="flex-1">
        {isEditingName ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setIsEditingName(false)}
            autoFocus
            className="h-9 font-bold text-lg px-2 -ml-2 rtl:-mr-2 rtl:ml-0 mb-1 bg-white"
          />
        ) : (
          <div 
            className="flex items-center gap-2 cursor-pointer group mb-1 w-fit"
            onClick={() => setIsEditingName(true)}
          >
            <p className="font-bold text-lg text-slate-900 group-hover:text-green-600 transition-colors">{name || t('Guest', 'ضيف')}</p>
            <Edit2 className="w-4 h-4 text-slate-400 group-hover:text-green-600" />
          </div>
        )}
        <p className="text-sm font-semibold text-slate-500 dir-ltr text-left w-fit" dir="ltr">{phone}</p>
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[95%] rounded-[32px] p-5 sm:p-6 border-none shadow-2xl max-h-[92dvh] overflow-y-auto pb-[max(1rem,calc(env(safe-area-inset-bottom)+88px))] scrollbar-thin">

        {/* Step 2: Order Type Selection */}
        {step === 'type' && (
          <>
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-black text-center">
                {t('Order Type', 'نوع الطلب')}
              </DialogTitle>
              <DialogDescription className="font-medium text-slate-500 text-center">
                {t('How would you like to receive your order?', 'كيف تريد استلام طلبك؟')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mb-6">
              {/* Receive in Person (pickup / in-store) - when business allows it */}
              {supportsReceiveInPerson && (
                <Button
                  onClick={() => handleTypeSelection('receive-in-person')}
                  className="w-full h-auto py-6 px-6 rounded-2xl font-bold text-lg bg-slate-900 hover:bg-slate-800 flex items-center justify-start gap-4 text-left"
                >
                  <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                    <Store className="w-7 h-7" />
                  </div>
                  <div className="flex-1">
                    <div className="font-black text-xl mb-1">
                      {t('Receive in Person', 'استلام شخصي')}
                    </div>
                    <div className="text-sm text-slate-300 font-normal">
                      {t('Pick up your order at the store', 'استلم طلبك من المتجر')}
                    </div>
                  </div>
                </Button>
              )}

              {/* Dine-in Option - only for businesses that support it (e.g. restaurant, cafe) */}
              {supportsDineIn && (
                <Button
                  onClick={() => handleTypeSelection('dine-in')}
                  className="w-full h-auto py-6 px-6 rounded-2xl font-bold text-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-start gap-4 text-left border border-slate-600"
                >
                  <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                    <UtensilsCrossed className="w-7 h-7" />
                  </div>
                  <div className="flex-1">
                    <div className="font-black text-xl mb-1">
                      {t('Dine-in', 'تناول الطعام هنا')}
                    </div>
                    <div className="text-sm text-slate-300 font-normal">
                      {t('Order at your table', 'اطلب على طاولتك')}
                    </div>
                  </div>
                </Button>
              )}

              {/* Delivery Option - when hasDelivery from menu, or (backward compat) when tenant has areas */}
              {showDeliveryOption && (
                <Button
                  onClick={() => handleTypeSelection('delivery')}
                  disabled={loading}
                  className="w-full h-auto py-6 px-6 rounded-2xl font-bold text-lg bg-green-600 hover:bg-green-700 flex items-center justify-start gap-4 text-left disabled:opacity-70 disabled:pointer-events-none"
                >
                  <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                    <Truck className="w-7 h-7" />
                  </div>
                  <div className="flex-1">
                    <div className="font-black text-xl mb-1">
                      {loading ? t('Loading…', 'جاري التحميل…') : t('Delivery', 'توصيل')}
                    </div>
                    <div className="text-sm text-green-100 font-normal">
                      {loading ? t('Checking delivery areas', 'جاري التحقق من مناطق التوصيل') : t('Get it delivered to your location', 'احصل عليه في موقعك')}
                    </div>
                  </div>
                </Button>
              )}
            </div>

            <Button
              onClick={handleBack}
              variant="ghost"
              className="w-full h-12 rounded-2xl font-black text-slate-400"
            >
              {t('Back', 'رجوع')}
            </Button>
          </>
        )}

        {/* Step 3: Receive in Person – WhatsApp required */}
        {step === 'details' && orderType === 'receive-in-person' && (
          <>
            <DialogHeader className="mb-6">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
                <Store className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black">
                {t('Receive in Person', 'استلام شخصي')}
              </DialogTitle>
              <DialogDescription className="font-medium text-slate-500">
                {t('Add your WhatsApp number so we can contact you if needed', 'أضف رقم واتساب للتواصل معك عند الحاجة')}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleFinalSubmit} className="space-y-6">
              {customerInfoHeader}

              {/* Timing — when closed, only scheduling is allowed */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0 flex items-center gap-1">
                  {t('Timing', 'التوقيت')}
                </label>
                {effectiveClosed && (
                  <p className="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    {t('Business is closed. Please schedule your order for when we open.', 'المتجر مغلق. يرجى جدولة طلبك لوقت الافتتاح.')}
                  </p>
                )}
                <div className="flex flex-col gap-3">
                  {!effectiveClosed && (
                    <label className="flex items-center gap-3 cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50 transition-all">
                      <input
                        type="radio"
                        name="timing"
                        checked={!isScheduled}
                        onChange={() => setIsScheduled(false)}
                        className="size-5 accent-slate-900"
                      />
                      <span className="font-bold text-slate-800">{t('As soon as possible (ASAP)', 'في أسرع وقت ممكن')}</span>
                    </label>
                  )}
                  <label className="flex flex-col gap-3 cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50 transition-all">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="timing"
                        checked={isScheduled}
                        onChange={() => setIsScheduled(true)}
                        className="size-5 accent-slate-900"
                        disabled={effectiveClosed}
                      />
                      <span className="font-bold text-slate-800">
                        {effectiveClosed ? t('Schedule for when we open', 'جدولة لوقت الافتتاح') : t('Schedule for later', 'جدولة لوقت لاحق')}
                      </span>
                    </div>
                    {(isScheduled || effectiveClosed) && (
                      <Input
                        type="datetime-local"
                        value={scheduledFor}
                        onChange={(e) => setScheduledFor(e.target.value)}
                        className="h-12 w-full mt-2"
                        required={isScheduled || effectiveClosed}
                        min={getMinDateTime()}
                      />
                    )}
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  className="flex-1 h-14 rounded-2xl font-black text-slate-400"
                >
                  {t('Back', 'رجوع')}
                </Button>
                <div className="flex-1 flex flex-col">
                  <Button
                    type="submit"
                    className="w-full h-14 rounded-2xl font-black bg-black text-white shadow-xl shadow-black/10 active:scale-[0.98] transition-all"
                    disabled={!phone.trim() || ((isScheduled || effectiveClosed) && (!scheduledFor || !!scheduleError))}
                  >
                    {t('Continue', 'متابعة')}
                  </Button>
                  {(isScheduled || effectiveClosed) && scheduleError && <p className="text-[10px] text-red-500 font-bold text-center leading-tight mt-1 px-1">{scheduleError}</p>}
                </div>
              </div>
            </form>
          </>
        )}

        {/* Step 3: Dine-in Details – table + WhatsApp required; scheduling when closed */}
        {step === 'details' && orderType === 'dine-in' && (
          <>
            <DialogHeader className="mb-6">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
                <UtensilsCrossed className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black">
                {t('Dine-in Details', 'تفاصيل تناول الطعام')}
              </DialogTitle>
              <DialogDescription className="font-medium text-slate-500">
                {t('Table number and WhatsApp so we can contact you if needed', 'رقم الطاولة وواتساب للتواصل معك عند الحاجة')}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleFinalSubmit} className="space-y-6">
              {customerInfoHeader}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0">
                  {t('Table Number', 'رقم الطاولة')} *
                </label>
                {isTableLocked ? (
                  <div className="h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center px-5">
                    <p className="font-bold text-lg text-slate-600">{tableNumber}</p>
                    <span className="ml-2 text-xs text-slate-400">({t('From QR code', 'من رمز QR')})</span>
                  </div>
                ) : (
                  <Input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder={t('Enter table number', 'أدخل رقم الطاولة')}
                    className="h-14 text-lg rounded-2xl border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold px-5"
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    autoFocus
                  />
                )}
                {!isTableLocked && (
                  <p className="text-xs text-slate-500 mt-1 ml-1 rtl:mr-1 rtl:ml-0">
                    {t('Please check the table number on your table', 'يرجى التحقق من رقم الطاولة على طاولتك')}
                  </p>
                )}
              </div>

              {effectiveClosed && (
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0">
                    {t('Schedule for when we open', 'جدولة لوقت الافتتاح')} *
                  </label>
                  <p className="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    {t('Business is closed. Please schedule your order for when we open.', 'المتجر مغلق. يرجى جدولة طلبك لوقت الافتتاح.')}
                  </p>
                  <Input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className="h-12 w-full"
                    required
                    min={getMinDateTime()}
                  />
                  {scheduleError && <p className="text-[10px] text-red-500 font-bold">{scheduleError}</p>}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  className="flex-1 h-14 rounded-2xl font-black text-slate-400"
                >
                  {t('Back', 'رجوع')}
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-14 rounded-2xl font-black bg-black text-white shadow-xl shadow-black/10 active:scale-[0.98] transition-all"
                  disabled={!tableNumber.trim() || !phone.trim() || (effectiveClosed && (!scheduledFor || !!scheduleError))}
                >
                  {t('Continue', 'متابعة')}
                </Button>
              </div>
            </form>
          </>
        )}

        {/* Step 3: Delivery Details — compact single-screen layout */}
        {step === 'details' && orderType === 'delivery' && (
          <>
            <DialogHeader className="mb-2 space-y-1 text-center sm:text-start rtl:sm:text-end">
              <div className="flex items-center justify-center sm:justify-start gap-2.5 rtl:sm:flex-row-reverse">
                <div className="w-9 h-9 shrink-0 bg-green-600 rounded-xl flex items-center justify-center">
                  <Truck className="w-5 h-5 text-white" aria-hidden />
                </div>
                <DialogTitle className="text-xl font-black leading-tight mb-0">
                  {t('Delivery Details', 'تفاصيل التوصيل')}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs font-medium text-slate-500 leading-snug">
                {t('Please provide your delivery information', 'يرجى تقديم معلومات التوصيل')}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleFinalSubmit} className="space-y-2.5">
              {/* Customer + delivery fee — one row */}
              <div className="grid grid-cols-2 gap-2 items-stretch">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 min-h-[4.5rem] flex flex-col justify-center">
                  {isEditingName ? (
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => setIsEditingName(false)}
                      autoFocus
                      className="h-8 font-bold text-sm px-2 -ml-1 rtl:-mr-1 rtl:ml-0 mb-1 bg-white"
                    />
                  ) : (
                    <button
                      type="button"
                      className="flex items-center gap-1.5 cursor-pointer group text-start rtl:text-end w-full"
                      onClick={() => setIsEditingName(true)}
                    >
                      <p className="font-bold text-sm text-slate-900 group-hover:text-green-600 transition-colors truncate">
                        {name || t('Guest', 'ضيف')}
                      </p>
                      <Edit2 className="w-3.5 h-3.5 shrink-0 text-slate-400 group-hover:text-green-600" aria-hidden />
                    </button>
                  )}
                  <p className="text-[11px] font-semibold text-slate-500 dir-ltr text-left w-full truncate mt-0.5" dir="ltr">
                    {phone}
                  </p>
                </div>

                <div className="rounded-xl border border-green-200 bg-green-50/95 p-2.5 min-h-[4.5rem] flex flex-col justify-center text-start rtl:text-end">
                  {isDistanceMode && deliveryLat != null && deliveryLng != null ? (
                    priceLoading ? (
                      <div className="flex items-center gap-1.5 text-green-700">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
                        <span className="text-[11px] font-bold leading-tight">{t('Calculating…', 'جاري الحساب…')}</span>
                      </div>
                    ) : distanceFee !== null && distanceKm !== null ? (
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex justify-between items-baseline gap-1">
                          <span className="text-[10px] font-black text-green-900 uppercase tracking-wide truncate">
                            {t('Delivery Fee', 'رسوم التوصيل')}
                          </span>
                          <span className="font-black text-green-700 text-sm shrink-0">
                            {tenantDeliveryFlags?.freeDeliveryEnabled
                              ? t('FREE', 'مجاناً')
                              : `${Number(distanceFee).toFixed(2)} ${formatCurrency(items[0]?.currency ?? 'ILS')}`}
                          </span>
                        </div>
                        {tenantDeliveryFlags?.freeDeliveryEnabled && (
                          <span className="text-[10px] font-semibold text-emerald-700 leading-tight line-clamp-2">
                            {t('Business covers delivery fee.', 'المتجر يتحمل رسوم التوصيل.')}
                          </span>
                        )}
                        <span className="text-[10px] font-medium text-green-600">
                          {t('Distance:', 'المسافة:')} ~{distanceKm.toFixed(1)} {t('km', 'كم')}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[10px] font-bold text-red-600 leading-tight">
                        {t('Fee unavailable', 'تعذر حساب الرسوم')}
                      </p>
                    )
                  ) : (
                    <div className="flex flex-col gap-0.5 justify-center min-h-[2.5rem]">
                      {locationLoading ? (
                        <div className="flex items-center gap-1.5 text-green-700">
                          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
                          <span className="text-[11px] font-bold leading-tight">{t('Finding you…', 'جاري تحديد موقعك…')}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] font-bold text-green-800/80 leading-tight">
                          {t('Waiting for location', 'بانتظار الموقع')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {(
                (cartTenant?.requiresPersonalShopper ||
                  cartTenant?.supportsDriverPickup ||
                  tenantDeliveryFlags?.requiresPersonalShopper ||
                  tenantDeliveryFlags?.supportsDriverPickup) &&
                items.length > 0
              ) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2">
                  {(() => {
                    const fee = getShopperFeeByItemCount(totalItems)
                    const expl = getShopperFeeExplanation(totalItems, lang, '₪')
                    const currencySymbol = items[0]?.currency === 'USD' ? '$' : items[0]?.currency === 'EUR' ? '€' : '₪'
                    return (
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <span className="font-bold text-amber-900 text-[11px] flex items-center gap-1">
                            <span aria-hidden>🛍️</span>
                            {t('Save Time fee', 'رسوم توفير الوقت')}
                          </span>
                          <p className="text-[10px] text-amber-800 mt-0.5 leading-snug line-clamp-2">{expl.body}</p>
                          {fee === 0 && (
                            <p className="text-[9px] text-amber-700/90 mt-0.5 line-clamp-1">
                              {t('Up to 3 items = free.', 'حتى 3 أصناف = مجاناً.')}
                            </p>
                          )}
                        </div>
                        <span className="font-black text-amber-700 text-sm shrink-0">
                          {fee === 0 ? t('FREE', 'مجاناً') : `${fee.toFixed(2)} ${currencySymbol}`}
                        </span>
                      </div>
                    )
                  })()}
                </div>
              )}

              {setDeliveryLocation && (
                <div className="rounded-xl border-2 border-slate-200 bg-slate-50/80 p-2.5 flex flex-col gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-800 leading-tight">{t('Delivery Location', 'موقع التوصيل')}</p>
                    <p className="text-[10px] text-slate-500 leading-tight">{t('Required for precise delivery', 'مطلوب للتوصيل الدقيق')}</p>
                  </div>

                  {deliveryLat == null || deliveryLng == null ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-2 mb-2">
                      <Locate className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[11px] font-bold text-amber-900 leading-tight">
                          {t('We need your location', 'نحتاج لموقعك')}
                        </p>
                        <p className="text-[10px] text-amber-700 leading-snug">
                          {t('Please allow location access, drag the map pin to your address, or paste a Maps link below.', 'يرجى السماح بالوصول للموقع، اسحب الدبوس لعنوانك، أو الصق رابط الخرائط أدناه.')}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className={`transition-all duration-300 w-full relative z-0 rounded-lg overflow-hidden border ${deliveryLat == null || deliveryLng == null ? 'border-amber-300 shadow-[0_0_0_2px_rgba(251,191,36,0.3)]' : 'border-slate-200/80'} ${showMapModal ? 'h-[min(220px,32dvh)]' : 'h-[160px]'}`}>
                    <LocationPickerMap
                      lat={mapLat}
                      lng={mapLng}
                      onChange={async (lat, lng) => {
                        setDeliveryLocation(lat, lng, null, 'manual_picker')
                        const name = await reverseGeocode(lat, lng)
                        if (name) setAddress(name)
                      }}
                      onRequestMyLocation={() => requestDeliveryLocation()}
                      locationLoading={locationLoading}
                      gpsAriaLabel={t('Use my current location', 'استخدام موقعي الحالي')}
                      centerPinAriaLabel={t('Center map on pin', 'توسيط الخريطة على الدبوس')}
                    />
                  </div>
                  <div className="flex justify-between items-center px-1 mb-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowLocationControls(!showLocationControls)}
                      className="h-6 text-[10px] font-bold px-2 ml-auto rtl:mr-auto rtl:ml-0 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      {showLocationControls ? t('Hide options', 'إخفاء الخيارات') : t('Location options', 'خيارات الموقع')}
                    </Button>
                  </div>
                  <div className={`grid grid-cols-2 sm:grid-cols-4 gap-1 transition-all duration-300 overflow-hidden ${showLocationControls ? 'max-h-[100px] opacity-100 mt-0.5' : 'max-h-0 opacity-0 m-0'}`}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => requestDeliveryLocation()}
                      disabled={locationLoading}
                      className="h-auto min-h-[2.75rem] py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 rounded-lg border-emerald-200 bg-emerald-50/80 text-[10px] font-bold text-emerald-900 hover:bg-emerald-100 leading-tight"
                    >
                      {locationLoading ? <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden /> : <Locate className="size-3.5 shrink-0" aria-hidden />}
                      <span className="text-center px-0.5 line-clamp-2">{t('Refresh location', 'تحديث الموقع')}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => requestDeliveryLocation({ highAccuracy: true })}
                      disabled={locationLoading}
                      className="h-auto min-h-[2.75rem] py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 rounded-lg border-slate-300 bg-white text-[10px] font-bold text-slate-800 leading-tight"
                    >
                      <span className="text-center px-0.5 line-clamp-2">{t('Improve accuracy', 'تحسين الدقة')}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowMapModal(!showMapModal)}
                      className="h-auto min-h-[2.75rem] py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 rounded-lg border-slate-300 bg-white text-[10px] font-bold text-slate-800 leading-tight"
                    >
                      <MapIcon className="size-3.5 shrink-0" aria-hidden />
                      <span className="text-center px-0.5 line-clamp-2">
                        {showMapModal ? t('Close Map', 'إغلاق الخريطة') : t('Adjust on Map', 'تعديل على الخريطة')}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant={showNotes ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setShowNotes(!showNotes)}
                      className={`h-auto min-h-[2.75rem] py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-bold leading-tight ${showNotes ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-300 bg-white text-slate-800'}`}
                    >
                      <Edit2 className="size-3.5 shrink-0" aria-hidden />
                      <span className="text-center px-0.5 line-clamp-2">{t('Add Details', 'إضافة تفاصيل')}</span>
                    </Button>
                  </div>

                  {(deliveryLat == null || deliveryLng == null) && (
                    <div className="pt-1.5 border-t border-slate-200/80">
                      <p className="text-[10px] font-semibold text-slate-500 mb-1">{t('Or paste Google Maps link', 'أو الصق رابط الخرائط')}</p>
                      <div className="relative">
                        <Link className="absolute left-2.5 rtl:right-2.5 rtl:left-auto top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" aria-hidden />
                        <input
                          type="url"
                          value={mapsLinkInput}
                          onChange={(e) => handleMapsLinkChange(e.target.value)}
                          placeholder={t('Maps link…', 'رابط الخرائط…')}
                          className="w-full h-9 pl-8 pr-2 rtl:pr-8 rtl:pl-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 font-medium"
                        />
                      </div>
                      {mapsLinkError && <p className="text-[10px] text-red-600 mt-1 font-medium">{mapsLinkError}</p>}
                    </div>
                  )}
                </div>
              )}

              {locationError && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2" role="alert">
                  <p className="text-[11px] text-amber-800 font-medium leading-snug">{locationError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1.5 h-8 rounded-lg border-amber-300 text-amber-900 bg-white text-xs font-bold hover:bg-amber-100"
                    onClick={() => {
                      setLocationError(null)
                      requestDeliveryLocation()
                    }}
                  >
                    {t('Try again', 'حاول مرة أخرى')}
                  </Button>
                </div>
              )}

              {(!setDeliveryLocation || (deliveryLat != null && deliveryLng != null && showNotes)) && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-0.5 rtl:mr-0.5 rtl:ml-0">
                    {t('Detailed address', 'العنوان التفصيلي')} ({t('optional', 'اختياري')})
                  </label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t('Street, building, floor…', 'الشارع، المبنى، الطابق…')}
                    className="w-full min-h-[68px] text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white transition-all font-semibold px-3 py-2 resize-none"
                    required={false}
                  />
                </div>
              )}

              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-0.5 rtl:mr-0.5 rtl:ml-0">
                  {t('Timing', 'التوقيت')}
                </label>
                {effectiveClosed && (
                  <p className="text-[11px] font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 leading-snug">
                    {t('Business is closed. Please schedule your order for when we open.', 'المتجر مغلق. يرجى جدولة طلبك لوقت الافتتاح.')}
                  </p>
                )}
                <div className={`grid gap-1.5 ${effectiveClosed ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {!effectiveClosed && (
                    <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-slate-200 bg-white p-2.5 has-[:checked]:border-green-600 has-[:checked]:bg-green-50/50 transition-all min-h-[3.25rem]">
                      <input
                        type="radio"
                        name="delivery_timing"
                        checked={!isScheduled}
                        onChange={() => setIsScheduled(false)}
                        className="size-4 shrink-0 accent-green-600"
                      />
                      <span className="font-bold text-slate-800 text-[11px] leading-tight">{t('As soon as possible (ASAP)', 'في أسرع وقت ممكن')}</span>
                    </label>
                  )}
                  <label
                    className={`flex flex-col gap-1.5 cursor-pointer rounded-xl border border-slate-200 bg-white p-2.5 has-[:checked]:border-green-600 has-[:checked]:bg-green-50/50 transition-all min-h-[3.25rem] ${effectiveClosed ? 'col-span-full' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="delivery_timing"
                        checked={isScheduled}
                        onChange={() => setIsScheduled(true)}
                        className="size-4 shrink-0 accent-green-600"
                        disabled={effectiveClosed}
                      />
                      <span className="font-bold text-slate-800 text-[11px] leading-tight">
                        {effectiveClosed ? t('Schedule for when we open', 'جدولة لوقت الافتتاح') : t('Schedule for later', 'جدولة لوقت لاحق')}
                      </span>
                    </div>
                    {(isScheduled || effectiveClosed) && (
                      <Input
                        type="datetime-local"
                        value={scheduledFor}
                        onChange={(e) => setScheduledFor(e.target.value)}
                        className="h-10 w-full text-sm"
                        required={isScheduled || effectiveClosed}
                        min={getMinDateTime()}
                      />
                    )}
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  type="submit"
                  className="w-full h-12 rounded-2xl font-black bg-green-600 text-white shadow-lg shadow-green-600/10 hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-50"
                  disabled={
                    !phone.trim() ||
                    deliveryLat == null ||
                    deliveryLng == null ||
                    ((isScheduled || effectiveClosed) && (!scheduledFor || !!scheduleError)) ||
                    distanceFee === null
                  }
                >
                  {t('Continue', 'متابعة')}
                </Button>
                {(isScheduled || effectiveClosed) && scheduleError && (
                  <p className="text-[10px] text-red-500 font-bold text-center leading-tight px-1 -mt-1">{scheduleError}</p>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  className="w-full h-11 rounded-2xl font-black text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                >
                  {t('Back', 'رجوع')}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
