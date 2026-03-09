'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/LanguageContext'
import { toEnglishDigits } from '@/lib/phone'
import { Store, UtensilsCrossed, Truck, User, MapPin, Phone, Locate, Check, Loader2, Link, Edit2, Map as MapIcon } from 'lucide-react'
import { OrderType } from './CartContext'
import { parseCoordsFromGoogleMapsUrl } from '@/lib/maps-utils'
import { useCart } from './CartContext'
import { isWithinShift } from '@/lib/business-hours'

const LocationPickerMap = dynamic(() => import('./LocationPickerMap'), { 
  ssr: false, 
  loading: () => <div className="h-full w-full bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div> 
})

interface Area {
  _id: string
  name_en: string
  name_ar: string
  deliveryPrice: number
  currency: string
  estimatedTime?: number
  isActive: boolean
}

interface UnifiedOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReceiveInPersonSubmit: (name: string, phone: string, scheduledFor?: string) => void
  onDineInSubmit: (name: string, table: string, phone: string) => void
  onDeliverySubmit: (name: string, phone: string, areaId: string, address: string, deliveryFee: number, scheduledFor?: string) => void
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
  setDeliveryLocation?: (lat: number, lng: number) => void
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
  const { cartTenant } = useCart()
  const [step, setStep] = useState<'type' | 'details'>(lockedTableNumber ? 'details' : 'type')
  const [orderType, setOrderType] = useState<OrderType | null>(lockedTableNumber ? 'dine-in' : null)

  const [isEditingName, setIsEditingName] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  // Timing
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledFor, setScheduledFor] = useState('')

  // Form fields
  const [name, setName] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [areaId, setAreaId] = useState('')
  const [address, setAddress] = useState('')

  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [mapsLinkInput, setMapsLinkInput] = useState('')
  const [mapsLinkError, setMapsLinkError] = useState<string | null>(null)

  // If deliveryPricingMode is undefined (e.g. old cart in localStorage), default to 'distance' for this test phase
  const isDistanceMode = cartTenant?.deliveryPricingMode === 'distance' || cartTenant?.deliveryPricingMode === undefined
  
  const showDeliveryOption = hasDelivery === true || (hasDelivery == null && tenantSlug && (loading || areas.length > 0 || isDistanceMode))

  const nameInputRef = useRef<HTMLInputElement>(null)
  const prevOpenRef = useRef(false)

  const [distanceFee, setDistanceFee] = useState<number | null>(null)
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)

  // Fetch delivery areas when dialog opens so we know whether to show Delivery option (only if tenant has areas)
  useEffect(() => {
    if (!open || !tenantSlug) return
    if (cartTenant?.deliveryPricingMode === 'distance') return
    setLoading(true)
    fetch(`/api/tenants/${tenantSlug}/areas`)
      .then((res) => (res.ok ? res.json() : []))
      .then((result) => setAreas(Array.isArray(result) ? result : []))
      .catch(() => setAreas([]))
      .finally(() => setLoading(false))
  }, [open, tenantSlug, cartTenant?.deliveryPricingMode])

  // Also ensure areas are loaded when user selects delivery (e.g. if fetch was slow)
  useEffect(() => {
    if (step !== 'details' || orderType !== 'delivery' || areas.length > 0) return
    if (!tenantSlug) return
    if (cartTenant?.deliveryPricingMode === 'distance') return
    setLoading(true)
    fetch(`/api/tenants/${tenantSlug}/areas`)
      .then((res) => (res.ok ? res.json() : []))
      .then((result) => setAreas(Array.isArray(result) ? result : []))
      .catch(() => setAreas([]))
      .finally(() => setLoading(false))
  }, [step, orderType, tenantSlug, areas.length, cartTenant?.deliveryPricingMode])

  // Fetch distance price when location changes in distance mode
  useEffect(() => {
    if (orderType !== 'delivery' || !isDistanceMode || !tenantSlug || deliveryLat == null || deliveryLng == null) return
    setPriceLoading(true)
    fetch(`/api/tenants/${tenantSlug}/delivery-price?lat=${deliveryLat}&lng=${deliveryLng}`)
      .then(res => res.json())
      .then(data => {
        if (data.suggestedFee !== undefined) {
          setDistanceFee(data.suggestedFee)
          setDistanceKm(data.distanceKm)
        }
      })
      .catch(err => console.error('Failed to fetch delivery price', err))
      .finally(() => setPriceLoading(false))
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
      setAreaId('')
      setAddress('')
      setAreas([])
      setIsScheduled(false)
      setScheduledFor('')
      setLocationError(null)
      setMapsLinkInput('')
      setMapsLinkError(null)
      setIsEditingName(false)
      setShowMapModal(false)
      setShowNotes(false)
      clearDeliveryLocation?.()
    } else if (open && !isEditingName && initialName && name === t('Guest', 'ضيف')) {
      // If the modal is already open but the initialName just loaded from Clerk, update it
      setName(initialName)
    }
  }, [open, initialName, initialPhone, clearDeliveryLocation, lockedTableNumber, t, isEditingName, name])

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

  /** Request location permission and get coordinates. Must be called from user gesture (tap) for iOS to show prompt. */
  const requestDeliveryLocation = useCallback(() => {
    if (!setDeliveryLocation || !navigator.geolocation) {
      if (!navigator.geolocation) {
        setLocationError(t('Location is not supported by your browser.', 'المتصفح لا يدعم الموقع.'))
      }
      return
    }
    setLocationError(null)
    setLocationLoading(true)

    const onSuccess = async (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      setDeliveryLocation(lat, lng)
      setLocationLoading(false)

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        const data = await res.json()
        if (data && data.display_name) {
          setAddress(prev => prev.trim() ? prev : data.display_name)
        }
      } catch (e) {
        // ignore error
      }
    }

    const onError = (err: GeolocationPositionError) => {
      if (err.code === 1) {
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
      } else if (err.code === 3) {
        setLocationError(
          t('Location request timed out. Try again or enter your address below.',
            'انتهت مهلة طلب الموقع. حاول مرة أخرى أو أدخل عنوانك أدناه.')
        )
      } else {
        setLocationError(
          t('Could not get location. Allow access when prompted, or enter your address below.',
            'تعذر الحصول على الموقع. اسمح بالوصول عند الطلب، أو أدخل عنوانك أدناه.')
        )
      }
      setLocationLoading(false)
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 25000,
      maximumAge: 60000,
    }

    navigator.geolocation.getCurrentPosition(onSuccess, (err) => {
      if (err.code === 3 && isIOS) {
        let resolved = false
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (resolved) return
            resolved = true
            navigator.geolocation.clearWatch(watchId)
            onSuccess(pos)
          },
          (watchErr) => {
            if (resolved) return
            resolved = true
            navigator.geolocation.clearWatch(watchId)
            onError(watchErr)
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        )
        setTimeout(() => {
          if (resolved) return
          resolved = true
          navigator.geolocation.clearWatch(watchId)
          onError(err)
        }, 16000)
      } else {
        onError(err)
      }
    }, options)
  }, [setDeliveryLocation, t, isIOS])

  const handleMapsLinkChange = (value: string) => {
    setMapsLinkInput(value)
    setMapsLinkError(null)
    if (!value.trim()) return
    const coords = parseCoordsFromGoogleMapsUrl(value.trim())
    if (coords && setDeliveryLocation) {
      setDeliveryLocation(coords.lat, coords.lng)
      setMapsLinkError(null)
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
    // Request location permission immediately when user chooses Delivery (user gesture = iOS allows prompt)
    if (type === 'delivery' && setDeliveryLocation) {
      requestDeliveryLocation()
    }
  }

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const finalScheduledFor = isScheduled && scheduledFor ? new Date(scheduledFor).toISOString() : undefined

    if (orderType === 'receive-in-person') {
      if (name.trim() && phone.trim()) {
        onReceiveInPersonSubmit(name.trim(), phone.trim(), finalScheduledFor)
        onOpenChange(false)
      }
    } else if (orderType === 'dine-in') {
      if (name.trim() && tableNumber.trim() && phone.trim()) {
        onDineInSubmit(name.trim(), tableNumber.trim(), phone.trim())
        onOpenChange(false)
      }
    } else if (orderType === 'delivery') {
      const deliveryFeeValue = isDistanceMode ? (distanceFee ?? 0) : (areas.find(a => a._id === areaId)?.deliveryPrice || 0)
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

      if (name.trim() && phone.trim() && (isDistanceMode || areaId)) {
        const addressValue = address.trim() || (hasSharedLocation ? t('Location shared', 'تم مشاركة الموقع') : '')
        onDeliverySubmit(name.trim(), phone.trim(), isDistanceMode ? '' : areaId, addressValue, deliveryFeeValue, finalScheduledFor)
        onOpenChange(false)
      }
    }
  }

  const handleBack = () => {
    if (step === 'details') {
      if (lockedTableNumber) {
        onOpenChange(false)
      } else {
        setStep('type')
        setOrderType(null)
      }
    } else if (step === 'type') {
      onOpenChange(false)
    }
  }

  const selectedArea = areas.find(a => a._id === areaId)

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

  // Re-validate when time changes
  useEffect(() => {
    if (isScheduled && scheduledFor) {
      setScheduleError(validateScheduleTime(scheduledFor));
    } else {
      setScheduleError(null);
    }
  }, [isScheduled, scheduledFor, cartTenant?.openingHours]);

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
      <DialogContent className="sm:max-w-md w-[95%] rounded-[32px] p-8 border-none shadow-2xl max-h-[90vh] overflow-y-auto pb-[max(2rem,calc(env(safe-area-inset-bottom)+100px))] scrollbar-thin">

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

              {/* Timing */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0 flex items-center gap-1">
                  {t('Timing', 'التوقيت')}
                </label>
                <div className="flex flex-col gap-3">
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
                  <label className="flex flex-col gap-3 cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50 transition-all">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="timing"
                        checked={isScheduled}
                        onChange={() => setIsScheduled(true)}
                        className="size-5 accent-slate-900"
                      />
                      <span className="font-bold text-slate-800">{t('Schedule for later', 'جدولة لوقت لاحق')}</span>
                    </div>
                    {isScheduled && (
                      <Input
                        type="datetime-local"
                        value={scheduledFor}
                        onChange={(e) => setScheduledFor(e.target.value)}
                        className="h-12 w-full mt-2"
                        required={isScheduled}
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
                    disabled={!phone.trim() || (isScheduled && (!scheduledFor || !!scheduleError))}
                  >
                    {t('Continue', 'متابعة')}
                  </Button>
                  {isScheduled && scheduleError && <p className="text-[10px] text-red-500 font-bold text-center leading-tight mt-1 px-1">{scheduleError}</p>}
                </div>
              </div>
            </form>
          </>
        )}

        {/* Step 3: Dine-in Details – table + WhatsApp required */}
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
                  disabled={!tableNumber.trim() || !phone.trim()}
                >
                  {t('Continue', 'متابعة')}
                </Button>
              </div>
            </form>
          </>
        )}

        {/* Step 3: Delivery Details */}
        {step === 'details' && orderType === 'delivery' && (
          <>
            <DialogHeader className="mb-6">
              <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center mb-4">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black">
                {t('Delivery Details', 'تفاصيل التوصيل')}
              </DialogTitle>
              <DialogDescription className="font-medium text-slate-500">
                {t('Please provide your delivery information', 'يرجى تقديم معلومات التوصيل')}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleFinalSubmit} className="space-y-5">
              {customerInfoHeader}

              {/* Delivery Area or Distance Fee */}
              {!isDistanceMode && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {t('Delivery Area', 'منطقة التوصيل')} *
                  </label>
                  {loading ? (
                    <div className="h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
                      <div className="text-sm text-slate-400">{t('Loading areas...', 'جارٍ تحميل المناطق...')}</div>
                    </div>
                  ) : areas.length === 0 ? (
                    <div className="h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
                      <div className="text-sm text-red-600 font-semibold">
                        {t('No delivery areas available', 'لا توجد مناطق توصيل متاحة')}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 w-full max-h-60 overflow-y-auto scrollbar-thin pr-1 rtl:pr-0 rtl:pl-1">
                      {areas.map((area) => {
                        const areaName = lang === 'ar' ? area.name_ar : area.name_en
                        const priceText = area.deliveryPrice === 0
                          ? t('Free', 'مجاني')
                          : `${area.deliveryPrice} ${area.currency}`
                        const timeText = area.estimatedTime
                          ? ` • ${area.estimatedTime} ${t('min', 'دقيقة')}`
                          : ''
                        return (
                          <label 
                            key={area._id} 
                            className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${areaId === area._id ? 'border-green-600 bg-green-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                          >
                            <input
                              type="radio"
                              name="delivery_area"
                              value={area._id}
                              checked={areaId === area._id}
                              onChange={(e) => setAreaId(e.target.value)}
                              className="size-5 accent-green-600 shrink-0"
                            />
                            <div className="flex-1">
                              <p className={`font-bold ${areaId === area._id ? 'text-green-900' : 'text-slate-800'}`}>
                                {areaName}
                              </p>
                              <p className="text-sm font-medium text-slate-500">
                                {t('Delivery:', 'التوصيل:')} <span className={area.deliveryPrice === 0 ? 'text-green-600 font-bold' : ''}>{priceText}</span>{timeText}
                              </p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Delivery location: Use my location or type address */}
              <div className="space-y-3">
                {isDistanceMode && deliveryLat != null && deliveryLng != null && (
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4 mb-4">
                    {priceLoading ? (
                      <div className="flex items-center gap-2 text-green-700">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-semibold">{t('Calculating delivery fee...', 'جاري حساب رسوم التوصيل...')}</span>
                      </div>
                    ) : distanceFee !== null && distanceKm !== null ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-green-900">{t('Delivery Fee', 'رسوم التوصيل')}</span>
                          <span className="font-black text-green-700 text-lg">{distanceFee} {t('ILS', 'شيكل')}</span>
                        </div>
                        <span className="text-xs font-medium text-green-600">
                          {t('Distance:', 'المسافة:')} ~{distanceKm.toFixed(1)} {t('km', 'كم')}
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm text-red-600 font-semibold">
                        {t('Could not calculate delivery fee. Please try a different location.', 'تعذر حساب رسوم التوصيل. يرجى تجربة موقع آخر.')}
                      </div>
                    )}
                  </div>
                )}
                {setDeliveryLocation && (
                  <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/80 p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-800 mb-0.5">
                          {t('Delivery Location', 'موقع التوصيل')}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t('Required for precise delivery', 'مطلوب للتوصيل الدقيق')}
                        </p>
                      </div>
                    </div>

                    {deliveryLat == null || deliveryLng == null ? (
                      <Button
                        type="button"
                        onClick={requestDeliveryLocation}
                        disabled={locationLoading}
                        className="w-full h-14 rounded-xl font-bold text-base bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-md flex items-center justify-center gap-2"
                      >
                        {locationLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 shrink-0 animate-spin" />
                            {t('Getting your location…', 'جاري الحصول على موقعك…')}
                          </>
                        ) : (
                          <>
                            <Locate className="w-5 h-5 shrink-0" />
                            {t('Share My Location', 'مشاركة موقعي')}
                          </>
                        )}
                      </Button>
                    ) : (
                      <>
                        <div className={`transition-all duration-300 w-full relative z-0 ${showMapModal ? 'h-[350px]' : 'h-[160px]'}`}>
                          <LocationPickerMap
                            lat={deliveryLat}
                            lng={deliveryLng}
                            onChange={(lat, lng) => setDeliveryLocation(lat, lng)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowMapModal(!showMapModal)}
                            className="flex-1 h-11 rounded-xl text-sm font-bold border-slate-300 bg-white"
                          >
                            <MapIcon className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                            {showMapModal ? t('Close Map', 'إغلاق الخريطة') : t('Adjust on Map', 'تعديل على الخريطة')}
                          </Button>
                          <Button
                            type="button"
                            variant={showNotes ? "default" : "outline"}
                            onClick={() => setShowNotes(!showNotes)}
                            className={`flex-1 h-11 rounded-xl text-sm font-bold ${showNotes ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-300 bg-white'}`}
                          >
                            <Edit2 className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                            {t('Add Details', 'إضافة تفاصيل')}
                          </Button>
                        </div>
                      </>
                    )}

                    {!!setDeliveryLocation && (deliveryLat == null || deliveryLng == null) && (
                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-xs font-semibold text-slate-500 mb-1.5">
                          {t('Or paste your Google Maps link:', 'أو الصق رابط Google Maps الخاص بك:')}
                        </p>
                        <div className="relative">
                          <Link className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          <input
                            type="url"
                            value={mapsLinkInput}
                            onChange={(e) => handleMapsLinkChange(e.target.value)}
                            placeholder={t('https://maps.google.com/...', 'https://maps.google.com/...')}
                            className="w-full h-11 pl-9 pr-4 rtl:pr-9 rtl:pl-4 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 font-medium"
                          />
                        </div>
                        {mapsLinkError && (
                          <p className="text-xs text-red-600 mt-1 font-medium">{mapsLinkError}</p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-1">
                          {t('Open Google Maps → long press your location → tap "Share" → copy link.', 'افتح Google Maps ← اضغط طويلاً على موقعك ← اضغط "مشاركة" ← انسخ الرابط.')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {locationError && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3" role="alert">
                    <p className="text-sm text-amber-800 font-medium">{locationError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 rounded-lg border-amber-300 text-amber-800 hover:bg-amber-100"
                      onClick={() => { setLocationError(null); requestDeliveryLocation() }}
                    >
                      {t('Try again', 'حاول مرة أخرى')}
                    </Button>
                  </div>
                )}
                {(!setDeliveryLocation || (deliveryLat != null && deliveryLng != null && showNotes)) && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0">
                      {t('Detailed address', 'العنوان التفصيلي')} ({t('optional', 'اختياري')})
                    </label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder={t('Street, building number, floor, apartment...', 'الشارع، رقم المبنى، الطابق، الشقة...')}
                      className="w-full min-h-[100px] text-base rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white transition-all font-semibold px-5 py-4 resize-none"
                      required={false}
                    />
                  </div>
                )}
              </div>

              {/* Timing */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0 flex items-center gap-1">
                  {t('Timing', 'التوقيت')}
                </label>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50 transition-all">
                    <input
                      type="radio"
                      name="delivery_timing"
                      checked={!isScheduled}
                      onChange={() => setIsScheduled(false)}
                      className="size-5 accent-slate-900"
                    />
                    <span className="font-bold text-slate-800">{t('As soon as possible (ASAP)', 'في أسرع وقت ممكن')}</span>
                  </label>
                  <label className="flex flex-col gap-3 cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50 transition-all">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="delivery_timing"
                        checked={isScheduled}
                        onChange={() => setIsScheduled(true)}
                        className="size-5 accent-slate-900"
                      />
                      <span className="font-bold text-slate-800">{t('Schedule for later', 'جدولة لوقت لاحق')}</span>
                    </div>
                    {isScheduled && (
                      <Input
                        type="datetime-local"
                        value={scheduledFor}
                        onChange={(e) => setScheduledFor(e.target.value)}
                        className="h-12 w-full mt-2"
                        required={isScheduled}
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
                    className="w-full h-14 rounded-2xl font-black bg-green-600 text-white shadow-xl shadow-green-600/10 hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-50"
                    disabled={!phone.trim() || (!isDistanceMode && !areaId) || deliveryLat == null || deliveryLng == null || (isScheduled && (!scheduledFor || !!scheduleError)) || (isDistanceMode && distanceFee === null)}
                  >
                    {t('Continue', 'متابعة')}
                  </Button>
                  {isScheduled && scheduleError && <p className="text-[10px] text-red-500 font-bold text-center leading-tight mt-1 px-1">{scheduleError}</p>}
                </div>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
