'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/LanguageContext'
import { toEnglishDigits } from '@/lib/phone'
import { Store, UtensilsCrossed, Truck, User, MapPin, Phone, Locate, Check, Loader2, Link } from 'lucide-react'
import { OrderType } from './CartContext'
import { parseCoordsFromGoogleMapsUrl } from '@/lib/maps-utils'

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
  onReceiveInPersonSubmit: (name: string, phone: string) => void
  onDineInSubmit: (name: string, table: string, phone: string) => void
  onDeliverySubmit: (name: string, phone: string, areaId: string, address: string, deliveryFee: number) => void
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
  const [step, setStep] = useState<'name' | 'type' | 'details'>('name')
  const [orderType, setOrderType] = useState<OrderType | null>(null)

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

  const showDeliveryOption = hasDelivery === true || (hasDelivery == null && tenantSlug && (loading || areas.length > 0))

  const nameInputRef = useRef<HTMLInputElement>(null)
  const prevOpenRef = useRef(false)

  // Fetch delivery areas when dialog opens so we know whether to show Delivery option (only if tenant has areas)
  useEffect(() => {
    if (!open || !tenantSlug) return
    setLoading(true)
    fetch(`/api/tenants/${tenantSlug}/areas`)
      .then((res) => (res.ok ? res.json() : []))
      .then((result) => setAreas(Array.isArray(result) ? result : []))
      .catch(() => setAreas([]))
      .finally(() => setLoading(false))
  }, [open, tenantSlug])

  // Also ensure areas are loaded when user selects delivery (e.g. if fetch was slow)
  useEffect(() => {
    if (step !== 'details' || orderType !== 'delivery' || areas.length > 0) return
    if (!tenantSlug) return
    setLoading(true)
    fetch(`/api/tenants/${tenantSlug}/areas`)
      .then((res) => (res.ok ? res.json() : []))
      .then((result) => setAreas(Array.isArray(result) ? result : []))
      .catch(() => setAreas([]))
      .finally(() => setLoading(false))
  }, [step, orderType, tenantSlug, areas.length])

  // Reset form only when dialog transitions from closed to open (not when location/callbacks update while open)
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current
    prevOpenRef.current = open
    if (justOpened) {
      setStep('name')
      setName(initialName)
      setOrderType(lockedTableNumber ? 'dine-in' : null)
      setTableNumber(lockedTableNumber ?? '')
      setPhone(initialPhone)
      setAreaId('')
      setAddress('')
      setAreas([])
      setLocationError(null)
      setMapsLinkInput('')
      setMapsLinkError(null)
      clearDeliveryLocation?.()
      setTimeout(() => nameInputRef.current?.focus(), 100)
    }
  }, [open, initialName, initialPhone, clearDeliveryLocation, lockedTableNumber])

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

    const onSuccess = (pos: GeolocationPosition) => {
      setDeliveryLocation(pos.coords.latitude, pos.coords.longitude)
      setLocationLoading(false)
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

    if (orderType === 'receive-in-person') {
      if (name.trim() && phone.trim()) {
        onReceiveInPersonSubmit(name.trim(), phone.trim())
        onOpenChange(false)
      }
    } else if (orderType === 'dine-in') {
      if (name.trim() && tableNumber.trim() && phone.trim()) {
        onDineInSubmit(name.trim(), tableNumber.trim(), phone.trim())
        onOpenChange(false)
      }
    } else if (orderType === 'delivery') {
      const selectedArea = areas.find(a => a._id === areaId)
      const deliveryFee = selectedArea?.deliveryPrice || 0
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

      if (name.trim() && phone.trim() && areaId) {
        const addressValue = address.trim() || (hasSharedLocation ? t('Location shared', 'تم مشاركة الموقع') : '')
        onDeliverySubmit(name.trim(), phone.trim(), areaId, addressValue, deliveryFee)
        onOpenChange(false)
      }
    }
  }

  const handleBack = () => {
    if (step === 'details') {
      setStep('type')
      setTableNumber('')
      setPhone('')
      setAreaId('')
      setAddress('')
    } else if (step === 'type') {
      setStep('name')
      setOrderType(null)
    }
  }

  const selectedArea = areas.find(a => a._id === areaId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[95%] rounded-[32px] p-8 border-none shadow-2xl max-h-[90vh] overflow-y-auto pb-[max(2rem,calc(env(safe-area-inset-bottom)+100px))]">

        {/* Step 1: Name */}
        {step === 'name' && (
          <>
            <DialogHeader className="mb-6">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
                <User className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black">
                {t('Welcome!', 'مرحباً!')}
              </DialogTitle>
              <DialogDescription className="font-medium text-slate-500">
                {t('Please enter your name to continue', 'يرجى إدخال اسمك للمتابعة')}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleNameNext} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0">
                  {t('Your Name', 'اسمك')} *
                </label>
                <Input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('Enter your name', 'أدخل اسمك')}
                  className="h-14 text-lg rounded-2xl border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold px-5"
                  required
                  inputMode="text"
                  autoComplete="name"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 h-14 rounded-2xl font-black text-slate-400"
                >
                  {t('Cancel', 'إلغاء')}
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-14 rounded-2xl font-black bg-black text-white shadow-xl shadow-black/10 active:scale-[0.98] transition-all"
                  disabled={!name.trim()}
                >
                  {t('Next', 'التالي')}
                </Button>
              </div>
            </form>
          </>
        )}

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
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0">
                  {t('Your Name', 'اسمك')}
                </label>
                <div className="h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center px-5">
                  <p className="font-bold text-lg text-slate-600">{name}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {t('WhatsApp / Mobile Number', 'رقم واتساب / الجوال')} *
                </label>
                <Input
                  type="tel"
                  value={phone}
                  readOnly
                  className="h-14 text-lg rounded-2xl border-slate-100 bg-slate-100 text-slate-500 font-bold px-5 cursor-not-allowed"
                  required
                  inputMode="tel"
                />
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
                  disabled={!phone.trim()}
                >
                  {t('Continue', 'متابعة')}
                </Button>
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
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0">
                  {t('Your Name', 'اسمك')}
                </label>
                <div className="h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center px-5">
                  <p className="font-bold text-lg text-slate-600">{name}</p>
                </div>
              </div>

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

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {t('WhatsApp / Mobile Number', 'رقم واتساب / الجوال')} *
                </label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(toEnglishDigits(e.target.value))}
                  placeholder={t('e.g., 0501234567', 'مثال: 0501234567')}
                  className="h-14 text-lg rounded-2xl border-slate-100 bg-slate-50 focus:bg-white transition-all font-bold px-5"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                />
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
              {/* Name (Read-only, already entered) */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0">
                  {t('Your Name', 'اسمك')}
                </label>
                <div className="h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center px-5">
                  <p className="font-bold text-lg text-slate-600">{name}</p>
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 rtl:mr-1 rtl:ml-0 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {t('Mobile Number', 'رقم الجوال')} *
                </label>
                <Input
                  type="tel"
                  value={phone}
                  readOnly
                  className="h-14 text-lg rounded-2xl border-slate-100 bg-slate-100 text-slate-500 font-bold px-5 cursor-not-allowed"
                  required
                  inputMode="tel"
                />
              </div>

              {/* Delivery Area */}
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
                  <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2 space-y-1.5">
                    {areas.map((area) => {
                      const areaName = lang === 'ar' ? area.name_ar : area.name_en
                      const priceText = area.deliveryPrice === 0
                        ? t('Free', 'مجاني')
                        : `${area.deliveryPrice} ${area.currency}`
                      const timeText = area.estimatedTime
                        ? ` • ${area.estimatedTime} ${t('min', 'دقيقة')}`
                        : ''
                      const isSelected = areaId === area._id
                      return (
                        <button
                          key={area._id}
                          type="button"
                          onClick={() => setAreaId(area._id)}
                          className={`w-full flex items-center justify-between p-3.5 rounded-xl text-left transition-all border ${
                            isSelected 
                              ? 'bg-green-50 border-green-500 shadow-sm ring-1 ring-green-500' 
                              : 'bg-white border-slate-100 hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <p className={`font-bold text-base ${isSelected ? 'text-green-900' : 'text-slate-800'}`}>
                              {areaName}
                            </p>
                            <p className={`text-xs mt-0.5 font-semibold ${isSelected ? 'text-green-700' : 'text-slate-500'}`}>
                              {t('Delivery:', 'التوصيل:')} {priceText}{timeText}
                            </p>
                          </div>
                          {isSelected && <Check className="w-5 h-5 text-green-600 shrink-0 ml-2 rtl:mr-2 rtl:ml-0" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Delivery location: Use my location or type address */}
              <div className="space-y-3">
                {setDeliveryLocation && (
                  <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-sm font-bold text-slate-800 mb-1">
                      {t('Where should we deliver?', 'أين نوصّل؟')}
                    </p>
                    <p className="text-xs text-slate-500 mb-3">
                      {t('Location sharing is required for delivery on iPhone, Android, and Desktop. Share your live location so the driver reaches you accurately.', 'مشاركة الموقع مطلوبة للتوصيل على iPhone وAndroid وسطح المكتب. شارك موقعك المباشر ليصل السائق إليك بدقة.')}
                    </p>
                    <Button
                      type="button"
                      onClick={requestDeliveryLocation}
                      disabled={locationLoading}
                      className="w-full h-12 rounded-xl font-bold text-base bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-sm flex items-center justify-center gap-2"
                    >
                      {locationLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 shrink-0 animate-spin" />
                          {t('Getting your location…', 'جاري الحصول على موقعك…')}
                        </>
                      ) : deliveryLat != null && deliveryLng != null ? (
                        <>
                          <Check className="w-5 h-5 shrink-0" />
                          {t('Location set', 'تم تحديد الموقع')}
                        </>
                      ) : (
                        <>
                          <Locate className="w-5 h-5 shrink-0" />
                          {t('Use my current location', 'استخدام موقعي الحالي')}
                        </>
                      )}
                    </Button>
                    {(deliveryLat != null && deliveryLng != null) && (
                      <p className="text-xs text-emerald-700 mt-2 font-medium">
                        {t('Driver will get a map link to this spot.', 'سيحصل السائق على رابط خريطة لهذا الموقع.')}
                      </p>
                    )}
                    {!!setDeliveryLocation && (deliveryLat == null || deliveryLng == null) && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
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
                <div className="space-y-1.5">
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
                  className="flex-1 h-14 rounded-2xl font-black bg-green-600 text-white shadow-xl shadow-green-600/10 hover:bg-green-700 active:scale-[0.98] transition-all"
                  disabled={!phone.trim() || !areaId || deliveryLat == null || deliveryLng == null}
                >
                  {t('Continue', 'متابعة')}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
