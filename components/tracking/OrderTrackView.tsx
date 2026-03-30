'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useLanguage } from '@/components/LanguageContext'
import { OrderRatingPrompt } from '@/components/rating/OrderRatingPrompt'
import { usePusherStream } from '@/lib/usePusherStream'
import { usePusherSubscription } from '@/hooks/usePusherSubscription'

// Dynamically imported — Leaflet requires window; avoids SSR crash
const CustomerTrackingMap = dynamic(
  () => import('@/components/Orders/CustomerTrackingMap'),
  { ssr: false }
)
import { getWhatsAppUrl, normalizePhoneForWhatsApp } from '@/lib/whatsapp'
import { formatCurrency } from '@/lib/currency'
import { getMapLink } from '@/lib/maps-utils'
import { getDeviceGeolocationPosition, isDeviceGeolocationSupported, watchDeviceGeolocation, clearDeviceGeolocationWatch, WatchGeolocationId, isGeolocationUserDenied } from '@/lib/device-geolocation'
import Link from 'next/link'
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Truck,
  Store,
  Phone,
  MessageCircle,
  Copy,
  ExternalLink,
  Package,
  MapPin,
  UtensilsCrossed,
  ArrowLeft,
  Flag,
  HandHelping,
  CreditCard,
  Banknote,
  Coins,
  Users,
  Heart,
  LocateFixed,
  ChevronDown,
  ShieldCheck,
  X,
  AlertTriangle,
  Pencil,
  Plus,
  Minus,
  Search,
  Trash2,
  ArrowRight,
  RefreshCw,
  LayoutGrid,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/ToastProvider'
import { ReportFormModal } from '@/components/Reports/ReportFormModal'
import { CustomerTrackPushStatusCard } from '@/components/push/CustomerTrackPushStatusCard'
import { CustomerTrackPushGate } from '@/app/(main)/t/[slug]/track/[token]/CustomerTrackPushGate'
import { BrowseMenuModal } from '@/components/Orders/BrowseMenuModal'

type OrderStatus =
  | 'new'
  | 'preparing'
  | 'waiting_for_delivery'
  | 'driver_on_the_way'
  | 'out-for-delivery'
  | 'completed'
  | 'served'
  | 'cancelled'
  | 'refunded'

type TrackData = {
  order: {
    _id: string
    orderNumber?: string
    orderType?: string
    status?: OrderStatus
    customerName?: string
    tableNumber?: string
    deliveryAddress?: string
    deliveryFee?: number
    deliveryFeePaidByBusiness?: boolean
    shopperFee?: number
    items?: Array<{ _key?: string; productId?: string; productName?: string; quantity?: number; price?: number; total?: number; notes?: string; addOns?: string; isPicked?: boolean; notPickedReason?: string; imageUrl?: string }>
    subtotal?: number
    totalAmount?: number
    currency?: string
    createdAt?: string
    preparedAt?: string | null
    driverAcceptedAt?: string | null
    driverPickedUpAt?: string | null
    cancelledAt?: string | null
    driverCancelledAt?: string | null
    completedAt?: string | null
    estimatedDeliveryMinutes?: number | null
    customer?: { _ref: string }
    site?: { _ref: string }
    tipPercent?: number
    tipAmount?: number
    tipSentToDriver?: boolean
    tipSentToDriverAt?: string | null
    tipConfirmedAfterCountdown?: boolean | null
    tipIncludedInTotal?: boolean
    tipRemovedByDriver?: boolean
    driverArrivedAt?: string | null
    /** Present when loaded via /order/[orderId]; same as URL token on /track/[token] */
    trackingToken?: string
    deliveryLat?: number | null
    deliveryLng?: number | null
    customerRequestedAt?: string | null
    customerRequestAcknowledgedAt?: string | null
    scheduledFor?: string | null
    scheduleEditHistory?: Array<{
      previousScheduledFor: string
      changedAt: string
    }>
    customerItemChangeStatus?: 'pending' | 'approved' | 'contact_requested' | 'driver_declined' | null
    customerRequestedItemChanges?: boolean
    customerItemChangeRequestedAt?: string | null
    customerItemChangeResolvedAt?: string | null
    customerItemChangeResponseNote?: string | null
    customerItemChangePreviousSubtotal?: number | null
    customerItemChangePreviousTotalAmount?: number | null
    customerItemChangeSummary?: Array<{
      type?: 'removed' | 'replaced' | 'edited' | 'not_picked'
      fromName?: string
      toName?: string
      fromQuantity?: number
      toQuantity?: number
      note?: string
    }>
    groupParticipantsCount?: number | null
    businessType?: string | null
  }
  restaurant: { name_en?: string; name_ar?: string; whatsapp?: string } | null
  driver: { _id: string; name: string; phoneNumber: string; lat: number | null; lng: number | null; rating?: { averageScore: number; totalCount: number } | null } | null
  country?: string
  businessLocation: { lat: number; lng: number } | null
}

type CustomerShareLocationOpts = { auto?: boolean }

/** Customer GPS for driver navigation. Requests location automatically once after load; button retries or updates. */
function CustomerLocationShare({ orderId, trackingToken }: { orderId: string; trackingToken: string }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [saved, setSaved] = useState<{ lat: number; lng: number } | null>(null)

  const shareLocation = useCallback(
    (opts?: CustomerShareLocationOpts) => {
      const isAuto = opts?.auto === true
      if (!isDeviceGeolocationSupported()) {
        if (!isAuto) {
          showToast('Location not supported in this browser.', 'الموقع غير مدعوم في هذا المتصفح.', 'error')
        }
        return
      }
      setState('loading')

      let bestFix: { coords: { latitude: number; longitude: number; accuracy: number } } | null = null
      let watchIdPromise: Promise<WatchGeolocationId> | null = null
      let timeoutId: number | null = null
      let fallbackTimeoutId: number | null = null

      const finishAndShare = async () => {
        if (watchIdPromise !== null) {
          watchIdPromise.then(id => clearDeviceGeolocationWatch(id))
          watchIdPromise = null
        }
        if (timeoutId !== null) window.clearTimeout(timeoutId)
        if (fallbackTimeoutId !== null) window.clearTimeout(fallbackTimeoutId)

        if (bestFix) {
          const lat = bestFix.coords.latitude
          const lng = bestFix.coords.longitude
          const accuracy = bestFix.coords.accuracy
          try {
            const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/location`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ trackingToken, lat, lng, accuracy, source: 'gps_high' }),
            })
            if (!res.ok) throw new Error('Failed')
            setSaved({ lat, lng })
            setState('done')
            if (!isAuto) {
              showToast('تم مشاركة موقعك مع السائق!', undefined, 'success')
            }
          } catch {
            setState('idle')
            if (!isAuto) {
              showToast('فشل مشاركة الموقع. حاول مرة أخرى.', undefined, 'error')
            }
          }
        } else {
          setState('idle')
          if (!isAuto) {
            showToast('Could not get a precise location. Try again.', 'تعذّر تحديد الموقع بدقة. حاول مرة أخرى.', 'error')
          }
        }
      }

      const onPosition = (pos: { latitude: number; longitude: number; accuracy?: number | null }) => {
        const accuracy = pos.accuracy ?? Infinity
        if (!bestFix || accuracy < bestFix.coords.accuracy) {
          bestFix = { coords: { latitude: pos.latitude, longitude: pos.longitude, accuracy } }
        }
        if (accuracy <= 25) {
          finishAndShare()
        }
      }

      const onError = (err: any) => {
        if (bestFix) {
          finishAndShare()
          return
        }

        if (watchIdPromise !== null) {
          watchIdPromise.then(id => clearDeviceGeolocationWatch(id))
          watchIdPromise = null
        }
        if (timeoutId !== null) window.clearTimeout(timeoutId)
        if (fallbackTimeoutId !== null) window.clearTimeout(fallbackTimeoutId)

        setState('idle')
        if (isAuto) return
        if (isGeolocationUserDenied(err)) {
          showToast(
            'Location access denied. Enable it in device settings.',
            'تم رفض الوصول للموقع. فعّله من إعدادات الجهاز.',
            'error'
          )
        } else {
          showToast('Could not get location. Try again.', 'تعذّر تحديد الموقع. حاول مرة أخرى.', 'error')
        }
      }

      // Give it 8 seconds to find a good fix, then just use the best we have
      timeoutId = window.setTimeout(() => {
        finishAndShare()
      }, 8000)

      // Ultimate fallback
      fallbackTimeoutId = window.setTimeout(() => {
        if (!bestFix) {
          finishAndShare()
        }
      }, 15000)

      watchIdPromise = watchDeviceGeolocation(onPosition, onError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }).catch(err => {
        onError(err)
        return '' as WatchGeolocationId
      })
    },
    [orderId, trackingToken, showToast],
  )

  useEffect(() => {
    if (!orderId || !trackingToken.trim()) return
    if (!isDeviceGeolocationSupported()) return

    let cancelled = false
    const handle = window.setTimeout(() => {
      if (!cancelled) shareLocation({ auto: true })
    }, 500)

    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [orderId, trackingToken, shareLocation])

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-blue-900 flex items-center gap-1.5">
          <LocateFixed className="h-4 w-4 shrink-0" />
          {state === 'loading' && !saved
            ? t('Getting your location…', 'جاري تحديد موقعك…')
            : state === 'done'
              ? t('Location shared with driver', 'تم مشاركة موقعك مع السائق')
              : t('Share your location with driver', 'شارك موقعك مع السائق')}
        </p>
        {saved ? (
          <p className="mt-0.5 text-xs text-blue-700">{saved.lat.toFixed(5)}, {saved.lng.toFixed(5)}</p>
        ) : (
          <p className="mt-0.5 text-xs text-blue-700">
            {t(
              'We request your location automatically to help the driver. You can update it anytime.',
              'نطلب موقعك تلقائياً لمساعدة السائق. يمكنك تحديثه في أي وقت.',
            )}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => shareLocation()}
        disabled={state === 'loading'}
        className="shrink-0 flex items-center gap-1.5 rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:opacity-50"
      >
        <LocateFixed className={`h-3.5 w-3.5 ${state === 'loading' ? 'animate-pulse' : ''}`} />
        {state === 'loading'
          ? t('Getting…', 'جاري…')
          : state === 'done'
            ? t('Update', 'تحديث')
            : t('Share', 'مشاركة')}
      </button>
    </div>
  )
}

/** Unified delivery box: countdown + total price + tipping + driver info. */
function DeliveryETABox({
  order,
  driver,
  countryCode,
  tipEnabled,
  selectedTipAmount,
  tipAmount,
  displayTotal,
  totalAmount,
  currency,
  onTipToggle,
  onTipAmountChange,
  onSendTipToDriver,
  onConfirmTipAfterCountdown,
  onConfirmTipIncludedInTotal,
  tipSending,
}: {
  order: TrackData['order']
  driver: TrackData['driver']
  countryCode: string
  tipEnabled: boolean
  selectedTipAmount: number
  tipAmount: number
  displayTotal: number
  totalAmount: number
  currency: string
  onTipToggle: (enabled: boolean) => void
  onTipAmountChange: (amount: number) => void
  onSendTipToDriver: () => void
  onConfirmTipAfterCountdown: (keep: boolean) => void
  onConfirmTipIncludedInTotal: (keep: boolean, reason?: string) => void
  tipSending: boolean
}) {
  const { t } = useLanguage()
  const [now, setNow] = useState(() => Date.now())
  const [driverInfoOpen, setDriverInfoOpen] = useState(false)
  const [arrivalPopupVisible, setArrivalPopupVisible] = useState(false)
  const [arrivalPopupDismissed, setArrivalPopupDismissed] = useState(false)
  const arrivalPopupTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [arrivalCountdown, setArrivalCountdown] = useState<number | null>(null)
  const [showRemoveReason, setShowRemoveReason] = useState(false)
  const [removeReason, setRemoveReason] = useState('')
  const [removeSending, setRemoveSending] = useState(false)
  const [acknowledgeChecked, setAcknowledgeChecked] = useState(false)
  const [showAddTipConfirmModal, setShowAddTipConfirmModal] = useState(false)
  const [showSendTipConfirmModal, setShowSendTipConfirmModal] = useState(false)

  const isActive =
    order.status === 'out-for-delivery' || order.status === 'driver_on_the_way'
  const isCompleted = order.status === 'completed'
  const isOutForDelivery = order.status === 'out-for-delivery'
  const isDriverToStore = order.status === 'driver_on_the_way'
  // Only show this box when driver is out-for-delivery or completed — not when driver is on the way to store (use top blue header only).
  const showBox = (order.status === 'out-for-delivery' || isCompleted) && order.orderType === 'delivery'
  const driverArrived = !!order.driverArrivedAt
  const tipWasSentToDriver = !!order.tipSentToDriver
  const tipIncluded = !!order.tipIncludedInTotal
  const tipRemovedByDriver = !!order.tipRemovedByDriver

  const prevDriverArrivedRef = useRef(driverArrived)
  useEffect(() => {
    if (!prevDriverArrivedRef.current && driverArrived) {
      import('@/lib/native-haptics').then(m => m.hapticNotification('success'))
    }
    prevDriverArrivedRef.current = driverArrived
  }, [driverArrived])

  useEffect(() => {
    if (!isActive || driverArrived) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isActive, driverArrived])

  const ARRIVAL_MODAL_SECONDS = 30
  useEffect(() => {
    if (driverArrived && tipWasSentToDriver && tipEnabled && !arrivalPopupDismissed && !tipIncluded && !tipRemovedByDriver) {
      setArrivalPopupVisible(true)
      setArrivalCountdown(ARRIVAL_MODAL_SECONDS)
      let remaining = ARRIVAL_MODAL_SECONDS
      const tick = setInterval(() => {
        remaining -= 1
        setArrivalCountdown(remaining)
        if (remaining <= 0) {
          clearInterval(tick)
        }
      }, 1000)
      arrivalPopupTimerRef.current = setTimeout(() => {
        setArrivalPopupVisible(false)
        setArrivalPopupDismissed(true)
        setArrivalCountdown(null)
        onConfirmTipIncludedInTotal(true)
      }, ARRIVAL_MODAL_SECONDS * 1000)
      return () => {
        clearInterval(tick)
        if (arrivalPopupTimerRef.current) clearTimeout(arrivalPopupTimerRef.current)
      }
    }
    return () => {
      if (arrivalPopupTimerRef.current) clearTimeout(arrivalPopupTimerRef.current)
    }
  }, [driverArrived, tipWasSentToDriver, tipEnabled, arrivalPopupDismissed, tipIncluded, tipRemovedByDriver])

  const handleArrivalOkay = () => {
    if (arrivalPopupTimerRef.current) clearTimeout(arrivalPopupTimerRef.current)
    setArrivalCountdown(null)
    setArrivalPopupVisible(false)
    setArrivalPopupDismissed(true)
    onConfirmTipIncludedInTotal(true)
  }

  const handleArrivalRemoveTip = () => {
    if (arrivalPopupTimerRef.current) clearTimeout(arrivalPopupTimerRef.current)
    setArrivalCountdown(null)
    setShowRemoveReason(true)
  }

  const handleReopenTipModal = () => {
    setArrivalPopupVisible(true)
  }

  const submitRemoveReason = async () => {
    if (!acknowledgeChecked || removeReason.trim().split(/\s+/).filter(Boolean).length < 5) return
    setRemoveSending(true)
    setArrivalPopupVisible(false)
    setArrivalPopupDismissed(true)
    setShowRemoveReason(false)
    setAcknowledgeChecked(false)
    try {
      await onConfirmTipIncludedInTotal(false, removeReason.trim())
    } finally {
      setRemoveSending(false)
    }
  }

  if (!showBox) return null

  const fmtCurrency = formatCurrency(currency)

  // ═══ COMPLETED STATE ═══
  if (isCompleted && order.completedAt) {
    const deliveredAt = new Date(order.completedAt)
    const fmt = deliveredAt.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    const pickedUpMs = order.driverPickedUpAt ? new Date(order.driverPickedUpAt).getTime() : null
    const completedMs = deliveredAt.getTime()
    const deliveryMinutes = pickedUpMs ? Math.max(1, Math.round((completedMs - pickedUpMs) / 60000)) : null
    const wasFast = deliveryMinutes != null && deliveryMinutes <= 15

    return (
      <div className="mt-6 px-4">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 text-emerald-200/40 pointer-events-none">
            <CheckCircle2 className="w-28 h-28" />
          </div>
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <div className="bg-emerald-600 p-2.5 rounded-xl text-white">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-emerald-900">
                {t('Delivered', 'تم التوصيل')}
              </h2>
              {deliveryMinutes != null && (
                <p className="text-base font-bold text-emerald-700">
                  ⏱️ {deliveryMinutes <= 1
                    ? t('Less than a minute!', 'أقل من دقيقة!')
                    : t(`${deliveryMinutes} minutes`, `${deliveryMinutes} دقيقة`)}
                </p>
              )}
              <p className="text-sm text-emerald-600">{fmt}</p>
            </div>
          </div>

          {wasFast && (
            <div className="relative z-10 rounded-2xl bg-emerald-100/80 border border-emerald-200/60 p-3 mt-3">
              <p className="text-center text-sm text-emerald-700 font-medium">
                ⚡ {t('That was a speedy delivery!', 'كان توصيل سريع!')} 💚
              </p>
            </div>
          )}

          {(order.tipAmount ?? 0) > 0 ? (
            <div className="relative z-10 rounded-2xl bg-emerald-100/80 border border-emerald-200/60 p-3 mt-3">
              <p className="text-center text-sm text-emerald-700 font-medium">
                💚 {t('Thank you for your generous tip! Your kindness truly brightens the driver\'s day.', 'شكراً لإكراميتك الكريمة! لطفك يصنع فرقاً كبيراً في يوم السائق.')}
              </p>
            </div>
          ) : (
            <div className="relative z-10 rounded-2xl bg-amber-50/80 border border-amber-200/60 p-3 mt-3">
              <p className="text-center text-sm text-amber-700 font-medium">
                {t('Next time, consider adding a small tip — it means a lot to drivers who work hard to deliver your order!', 'في المرة القادمة، فكّر بإضافة إكرامية صغيرة — تعني الكثير للسائقين الذين يعملون بجد لتوصيل طلبك!')} 💛
              </p>
            </div>
          )}

          {driver && (
            <div className="relative z-10 mt-3 pt-3 border-t border-emerald-200/60">
              <p className="text-sm text-emerald-800">
                <span className="font-semibold">{t('Driver', 'السائق')}:</span>{' '}
                {driver.name}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ═══ ACTIVE STATE ═══
  const pickedUpAt = order.driverPickedUpAt
    ? new Date(order.driverPickedUpAt).getTime()
    : null
  const etaMinutes = order.estimatedDeliveryMinutes
  const hasCountdown = isActive && pickedUpAt && etaMinutes && isOutForDelivery && !driverArrived

  let countdownMinutes = 0
  let countdownSeconds = 0
  let isOverdue = false

  if (hasCountdown) {
    const targetMs = pickedUpAt + etaMinutes * 60 * 1000
    const remainMs = targetMs - now
    if (remainMs <= 0) {
      isOverdue = true
    } else {
      countdownMinutes = Math.floor(remainMs / 60000)
      countdownSeconds = Math.floor((remainMs % 60000) / 1000)
    }
  }

  const countdownExpired = isOutForDelivery && pickedUpAt && etaMinutes && !driverArrived &&
    (pickedUpAt + etaMinutes * 60 * 1000) < now
  const showTipExpiredPrompt = countdownExpired && tipWasSentToDriver && tipEnabled &&
    order.tipConfirmedAfterCountdown == null

  return (
    <div className="mt-6 px-4">
      <div className="rounded-3xl overflow-hidden shadow-md border border-slate-200">

        {/* ═══ SECTION 1: COUNTDOWN (Blue header when active, emerald when arrived) ═══ */}
        <div className={`px-5 pt-5 pb-4 text-white relative overflow-hidden ${
          driverArrived
            ? 'bg-emerald-600'
            : 'bg-slate-900'
        }`}>
          <div className="absolute -right-6 -top-6 text-white/[0.07] pointer-events-none">
            <Truck className="w-32 h-32" />
          </div>

          <div className="flex items-center gap-3 mb-3 relative z-10">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
              {driverArrived ? <CheckCircle2 className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-black">
                {driverArrived
                  ? t('Driver has arrived!', 'السائق وصل!')
                  : isDriverToStore
                    ? t('Driver heading to the store', 'السائق في الطريق إلى المتجر')
                    : t('On the way to you', 'في الطريق إليك')}
              </h2>
              {driverArrived && (
                <p className="text-xs text-white/80 font-medium">
                  {t('Please prepare to receive your order', 'يرجى الاستعداد لاستلام طلبك')}
                </p>
              )}
              {hasCountdown && !isOverdue && !driverArrived && (
                <p className="text-xs text-white/75 font-medium">
                  {t('Estimated arrival', 'الوصول المتوقع')}
                </p>
              )}
            </div>
          </div>

          {hasCountdown && (
            <div className="relative z-10">
              {isOverdue ? (
                <div className="text-center py-2 rounded-2xl bg-white/10 backdrop-blur-sm">
                  <p className="text-amber-200 font-bold text-sm">
                    {t('Arriving any moment now…', 'يصل في أي لحظة…')}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-3 text-center min-w-[80px]">
                    <span className="text-3xl font-black tabular-nums block">
                      {String(countdownMinutes).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
                      {t('min', 'دقيقة')}
                    </span>
                  </div>
                  <span className="text-2xl font-black text-white/40">:</span>
                  <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-3 text-center min-w-[80px]">
                    <span className="text-3xl font-black tabular-nums block">
                      {String(countdownSeconds).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
                      {t('sec', 'ثانية')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {!hasCountdown && isDriverToStore && (
            <div className="relative z-10 text-center py-2 rounded-2xl bg-white/10 backdrop-blur-sm">
              <p className="text-white/90 font-semibold text-sm">
                {t('The driver is picking up your order', 'السائق يستلم طلبك')}
              </p>
            </div>
          )}
        </div>

        {/* ═══ COUNTDOWN EXPIRED TIP PROMPT ═══ */}
        {showTipExpiredPrompt && (
          <div className="bg-amber-50 border-b border-amber-200/60 px-5 py-4">
            <p className="font-bold text-amber-800 text-sm mb-1">
              {t('Delivery took a bit longer', 'التوصيل استغرق وقتاً أطول')}
            </p>
            <p className="text-xs text-amber-600 mb-3 leading-relaxed">
              {t(
                'The tip you sent to the driver has been paused. Would you still like to keep it?',
                'الإكرامية التي أرسلتها للسائق تم تعليقها. هل تود الاحتفاظ بها؟'
              )}
            </p>
            <div className="flex gap-3">
              <motion.button
                type="button"
                onClick={() => onConfirmTipAfterCountdown(true)}
                whileTap={{ scale: 0.95 }}
                className="flex-1 py-3 rounded-2xl font-bold text-sm bg-emerald-500 text-white shadow-md"
              >
                💚 {t('Yes, keep the tip', 'نعم، أبقِ الإكرامية')}
              </motion.button>
              <motion.button
                type="button"
                onClick={() => onConfirmTipAfterCountdown(false)}
                whileTap={{ scale: 0.95 }}
                className="flex-1 py-3 rounded-2xl font-bold text-sm bg-slate-200 text-slate-700"
              >
                {t('Remove tip', 'إزالة الإكرامية')}
              </motion.button>
            </div>
          </div>
        )}

        {/* ═══ SECTION 2: TOTAL PRICE (Clean white) ═══ */}
        {isOutForDelivery && (
          <div className="bg-white px-5 py-5">
            <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-1.5">
              {tipIncluded
                ? t('Total to pay (incl. tip)', 'المبلغ المطلوب (شامل الإكرامية)')
                : t('Total to pay (Cash on Delivery)', 'المبلغ المطلوب (الدفع عند الاستلام)')}
            </p>
            <div className="flex items-baseline gap-2">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={(tipIncluded ? displayTotal : (order.totalAmount ?? 0)).toFixed(2)}
                  initial={{ y: -12, opacity: 0, scale: 0.9 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 12, opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                  className={`text-4xl font-black tabular-nums inline-block ${tipIncluded ? 'text-emerald-700' : 'text-slate-900'}`}
                >
                  {(tipIncluded ? displayTotal : (tipRemovedByDriver ? (order.totalAmount ?? 0) : displayTotal)).toFixed(2)}
                </motion.span>
              </AnimatePresence>
              <span className="text-lg font-bold text-slate-300">{fmtCurrency}</span>
            </div>
            <AnimatePresence>
              {tipIncluded && tipAmount > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 rounded-xl bg-emerald-50/80 border border-emerald-200/50 p-3 space-y-1">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>{t('Order total', 'مجموع الطلب')}</span>
                      <span className="font-medium">{(order.totalAmount ?? 0).toFixed(2)} {fmtCurrency}</span>
                    </div>
                    <div className="flex justify-between text-xs text-emerald-600 font-medium">
                      <span>💚 {t('Tip', 'إكرامية')}</span>
                      <span>+{tipAmount.toFixed(2)} {fmtCurrency}</span>
                    </div>
                    <div className="flex justify-between text-sm text-emerald-800 font-bold pt-1 border-t border-emerald-200/50">
                      <span>{t('Total', 'المجموع')}</span>
                      <span>{displayTotal.toFixed(2)} {fmtCurrency}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {tipEnabled && tipAmount > 0 && !tipIncluded && !tipRemovedByDriver && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <p className="text-sm text-rose-500 font-medium mt-1.5">
                    💜 {t('Includes tip', 'يشمل إكرامية')}: +{tipAmount.toFixed(2)} {fmtCurrency}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ═══ SECTION 3: TIP (Warm rose) ═══ */}
        {/* When driver has arrived and tip was sent: collapse full tip controls, show locked badge */}
        {isOutForDelivery && driverArrived && tipWasSentToDriver && tipEnabled && (
          <div className="bg-gradient-to-b bg-emerald-50 px-5 py-4 border-t border-emerald-200/40">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 rounded-2xl bg-white/80 border border-emerald-200/60 p-4 shadow-sm"
            >
              <div className="bg-emerald-100 p-2.5 rounded-xl shrink-0">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-emerald-800 text-sm">
                  {tipIncluded
                    ? t('Tip added to total', 'الإكرامية مضافة للمجموع')
                    : tipRemovedByDriver
                      ? t('Tip was removed', 'تمت إزالة الإكرامية')
                      : t('Tip is being confirmed', 'جاري تأكيد الإكرامية')}
                </p>
                {tipIncluded && (
                  <p className="text-xs text-emerald-600 mt-0.5">
                    💚 +{tipAmount.toFixed(2)} {fmtCurrency}
                  </p>
                )}
                {tipRemovedByDriver && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('The driver chose not to collect the tip.', 'السائق اختار عدم أخذ الإكرامية.')}
                  </p>
                )}
                {tipIncluded && !tipRemovedByDriver && (
                  <button
                    type="button"
                    onClick={handleReopenTipModal}
                    className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700 underline underline-offset-1"
                  >
                    {t('Change tip decision', 'تغيير قرار الإكرامية')}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* When driver arrived but customer hasn't added a tip: allow add with confirmation */}
        {isOutForDelivery && driverArrived && !tipWasSentToDriver && (
          <div className="bg-gradient-to-b bg-amber-50 px-5 py-5 border-t border-amber-200/40">
            <div className="flex items-center gap-2 mb-1.5">
              <Heart className="h-5 w-5 text-amber-500" />
              <p className="font-bold text-amber-900 text-[15px]">
                {t('Thank your driver with a tip?', 'هل تود شكر السائق بإكرامية؟')}
              </p>
            </div>
            <p className="text-xs text-amber-700/80 mb-4 leading-relaxed">
              {t(
                'A small gesture that makes a big difference! Confirm before sending to avoid mistakes.',
                'لفتة صغيرة تصنع فرقاً! أكّد قبل الإرسال لتجنّب الأخطاء.'
              )}
            </p>

            {/* Yes / No */}
            <div className="flex gap-3">
              <motion.button
                type="button"
                onClick={() => onTipToggle(true)}
                whileTap={{ scale: 0.95 }}
                className={`flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 ${
                  tipEnabled
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-300/40'
                    : 'bg-white text-amber-600 border-2 border-amber-200 hover:border-amber-300 hover:bg-amber-50'
                }`}
              >
                {tipEnabled ? '💚 ' : ''}{t('Yes, add a tip!', 'نعم، أضف إكرامية!')}
              </motion.button>
              <motion.button
                type="button"
                onClick={() => onTipToggle(false)}
                whileTap={{ scale: 0.95 }}
                className={`flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 ${
                  !tipEnabled
                    ? 'bg-slate-600 text-white shadow-lg shadow-slate-300/40'
                    : 'bg-white text-slate-400 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t('No, thanks', 'لا، شكراً')}
              </motion.button>
            </div>

            {/* Amount selector */}
            <AnimatePresence>
              {tipEnabled && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="pt-4">
                    <p className="text-xs text-amber-600/80 font-semibold mb-2.5">
                      {t('Choose tip amount', 'اختر مبلغ الإكرامية')}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {getSuggestedTips(totalAmount).map((amt) => (
                        <motion.button
                          key={amt}
                          type="button"
                          onClick={() => onTipAmountChange(amt)}
                          whileTap={{ scale: 0.9 }}
                          animate={selectedTipAmount === amt ? { scale: [1, 1.08, 1] } : {}}
                          transition={{ duration: 0.25 }}
                          className={`flex-1 min-w-[3.5rem] py-2.5 rounded-2xl text-sm font-bold transition-all duration-200 ${
                            selectedTipAmount === amt
                              ? 'bg-amber-500 text-white shadow-md shadow-amber-300/50 ring-2 ring-amber-300/60'
                              : 'bg-white text-amber-500 border border-amber-200 hover:border-amber-300 hover:bg-amber-50'
                          }`}
                        >
                          +{amt} {fmtCurrency}
                        </motion.button>
                      ))}
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={`${selectedTipAmount}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="text-center text-xs text-amber-500 mt-3"
                      >
                        {t('New total:', 'المجموع الجديد:')} {(totalAmount + selectedTipAmount).toFixed(2)} {fmtCurrency}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Add tip button — opens confirmation modal */}
            <AnimatePresence>
              {tipEnabled && tipAmount > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3">
                    <motion.button
                      type="button"
                      onClick={() => setShowAddTipConfirmModal(true)}
                      disabled={tipSending}
                      whileTap={{ scale: 0.97 }}
                      className="w-full py-3.5 rounded-2xl font-bold text-sm bg-amber-500 text-slate-950 shadow-lg shadow-amber-300/30 disabled:opacity-60 transition-all"
                    >
                      {t('Add tip for driver', 'أضف إكرامية للسائق')} 🚀
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Confirmation modal */}
            <AnimatePresence>
              {showAddTipConfirmModal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
                  onClick={() => !tipSending && setShowAddTipConfirmModal(false)}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-center font-bold text-slate-800 text-lg">
                      {t('Confirm add tip?', 'تأكيد إضافة الإكرامية؟')}
                    </p>
                    <p className="text-center text-slate-600 text-sm mt-2">
                      {t('You are about to add', 'ستقوم بإضافة')} <span className="font-bold text-amber-600">+{tipAmount.toFixed(2)} {fmtCurrency}</span> {t('as a tip. The driver will be notified.', 'كإكرامية. سيتم إشعار السائق.')}
                    </p>
                    <p className="text-center text-xs text-slate-500 mt-1">
                      {t('This prevents accidental taps.', 'هذا يمنع الضغط بالخطأ.')}
                    </p>
                    <div className="flex gap-3 mt-6">
                      <motion.button
                        type="button"
                        onClick={() => setShowAddTipConfirmModal(false)}
                        disabled={tipSending}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 py-3 rounded-xl font-bold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                      >
                        {t('Cancel', 'إلغاء')}
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={async () => {
                          setShowAddTipConfirmModal(false)
                          onSendTipToDriver()
                        }}
                        disabled={tipSending}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 py-3 rounded-xl font-bold text-sm bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                      >
                        {tipSending ? t('Sending…', 'جاري الإرسال…') : t('Confirm', 'تأكيد')}
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* When driver has NOT arrived: show full tip controls */}
        {isOutForDelivery && !driverArrived && (
          <div className="bg-gradient-to-b bg-rose-50 px-5 py-5 border-t border-rose-200/40">
            <div className="flex items-center gap-2 mb-1.5">
              <Heart className="h-5 w-5 text-rose-400" />
              <p className="font-bold text-rose-800 text-[15px]">
                {t('Would you like to thank your driver?', 'هل تود شكر السائق؟')}
              </p>
            </div>
            <p className="text-xs text-rose-500/70 mb-4 leading-relaxed">
              {t(
                'A small gesture that makes a big difference in their day!',
                'لفتة صغيرة تصنع فرقاً كبيراً في يومه!'
              )}
            </p>

            {/* Yes / No */}
            <div className="flex gap-3">
              <motion.button
                type="button"
                onClick={() => onTipToggle(true)}
                whileTap={{ scale: 0.95 }}
                className={`flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 ${
                  tipEnabled
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-300/40'
                    : 'bg-white text-rose-600 border-2 border-rose-200 hover:border-rose-300 hover:bg-rose-50'
                }`}
              >
                {tipEnabled ? '💚 ' : ''}{t('Yes, add a tip!', 'نعم، أضف إكرامية!')}
              </motion.button>
              <motion.button
                type="button"
                onClick={() => onTipToggle(false)}
                whileTap={{ scale: 0.95 }}
                className={`flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 ${
                  !tipEnabled
                    ? 'bg-slate-600 text-white shadow-lg shadow-slate-300/40'
                    : 'bg-white text-slate-400 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t('No, thanks', 'لا، شكراً')}
              </motion.button>
            </div>

            {/* Amount selector */}
            <AnimatePresence>
              {tipEnabled && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="pt-4">
                    <p className="text-xs text-rose-600/80 font-semibold mb-2.5">
                      {t('Choose tip amount', 'اختر مبلغ الإكرامية')}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {getSuggestedTips(totalAmount).map((amt) => (
                        <motion.button
                          key={amt}
                          type="button"
                          onClick={() => onTipAmountChange(amt)}
                          whileTap={{ scale: 0.9 }}
                          animate={selectedTipAmount === amt ? { scale: [1, 1.08, 1] } : {}}
                          transition={{ duration: 0.25 }}
                          className={`flex-1 min-w-[3.5rem] py-2.5 rounded-2xl text-sm font-bold transition-all duration-200 ${
                            selectedTipAmount === amt
                              ? 'bg-rose-500 text-white shadow-md shadow-rose-300/50 ring-2 ring-rose-300/60'
                              : 'bg-white text-rose-500 border border-rose-200 hover:border-rose-300 hover:bg-rose-50'
                          }`}
                        >
                          +{amt} {fmtCurrency}
                        </motion.button>
                      ))}
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={`${selectedTipAmount}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="text-center text-xs text-rose-400 mt-3"
                      >
                        {t('New total:', 'المجموع الجديد:')} {(totalAmount + selectedTipAmount).toFixed(2)} {fmtCurrency}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Send tip to driver button — confirmation prevents accidental send */}
            <AnimatePresence>
              {tipEnabled && tipAmount > 0 && !tipWasSentToDriver && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3">
                    <motion.button
                      type="button"
                      onClick={() => setShowSendTipConfirmModal(true)}
                      disabled={tipSending}
                      whileTap={{ scale: 0.97 }}
                      className="w-full py-3.5 rounded-2xl font-bold text-sm bg-slate-900 text-white shadow-lg shadow-purple-300/30 disabled:opacity-60 transition-all"
                    >
                      {tipSending
                        ? t('Sending…', 'جاري الإرسال…')
                        : t('Send tip to driver', 'أرسل الإكرامية للسائق')} 🚀
                    </motion.button>
                    <p className="text-[10px] text-rose-400/70 mt-2 text-center leading-relaxed">
                      {t(
                        'The driver will see your tip as encouragement. Confirm before sending to prevent mistakes.',
                        'سيرى السائق الإكرامية كتشجيع. أكّد قبل الإرسال لتجنّب الأخطاء.'
                      )}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pre-arrival send tip confirmation modal */}
            <AnimatePresence>
              {showSendTipConfirmModal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
                  onClick={() => !tipSending && setShowSendTipConfirmModal(false)}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-center font-bold text-slate-800 text-lg">
                      {t('Confirm send tip?', 'تأكيد إرسال الإكرامية؟')}
                    </p>
                    <p className="text-center text-slate-600 text-sm mt-2">
                      {t('You are about to send', 'ستقوم بإرسال')} <span className="font-bold text-purple-600">+{tipAmount.toFixed(2)} {fmtCurrency}</span> {t('as a tip. The driver will be notified.', 'كإكرامية. سيتم إشعار السائق.')}
                    </p>
                    <p className="text-center text-xs text-slate-500 mt-1">
                      {t('This prevents accidental taps.', 'هذا يمنع الضغط بالخطأ.')}
                    </p>
                    <div className="flex gap-3 mt-6">
                      <motion.button
                        type="button"
                        onClick={() => setShowSendTipConfirmModal(false)}
                        disabled={tipSending}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 py-3 rounded-xl font-bold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                      >
                        {t('Cancel', 'إلغاء')}
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={async () => {
                          setShowSendTipConfirmModal(false)
                          onSendTipToDriver()
                        }}
                        disabled={tipSending}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 py-3 rounded-xl font-bold text-sm bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50"
                      >
                        {tipSending ? t('Sending…', 'جاري الإرسال…') : t('Confirm', 'تأكيد')}
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sent confirmation */}
            <AnimatePresence>
              {tipEnabled && tipWasSentToDriver && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 rounded-2xl bg-purple-100/80 border border-purple-200/60 p-3 text-center"
                >
                  <p className="text-xs text-purple-700 font-medium">
                    ✅ {t(
                      'Tip sent! Your driver can see your generous gesture.',
                      'تم إرسال الإكرامية! يمكن للسائق رؤية لفتتك الكريمة.'
                    )}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* "No worries" message when tip is off */}
            <AnimatePresence>
              {!tipEnabled && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-xs text-slate-400 mt-3"
                >
                  {t('No worries! You can change your mind anytime.', 'لا مشكلة! يمكنك تغيير رأيك في أي وقت.')}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ═══ ARRIVAL TIP POPUP — shows for 30s when driver arrives ═══ */}
        <AnimatePresence>
          {arrivalPopupVisible && !showRemoveReason && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
              onClick={handleArrivalOkay}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="relative w-full max-w-md max-h-[min(560px,calc(100dvh-6rem))] overflow-y-auto rounded-3xl bg-white shadow-2xl my-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-b from-emerald-500 to-emerald-600 px-6 pt-6 pb-5 text-white text-center relative overflow-hidden">
                  <div className="absolute -right-6 -top-6 text-white/10 pointer-events-none">
                    <ShieldCheck className="w-28 h-28" />
                  </div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 400, damping: 15 }}
                    className="inline-flex p-3 rounded-full bg-white/20 backdrop-blur-sm mb-3"
                  >
                    <ShieldCheck className="w-8 h-8" />
                  </motion.div>
                  <h3 className="text-xl font-black">
                    {t('Driver has arrived!', 'السائق وصل!')}
                  </h3>
                  <p className="text-sm text-white/80 mt-1">
                    {t('Your tip will be added to the total', 'سيتم إضافة إكراميتك إلى المجموع')}
                  </p>
                </div>

                <div className="px-6 py-5">
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200/60 p-4 text-center mb-4">
                    <p className="text-sm text-emerald-700 font-medium mb-1">
                      {t('Tip amount', 'مبلغ الإكرامية')}
                    </p>
                    <p className="text-3xl font-black text-emerald-800 tabular-nums">
                      +{tipAmount.toFixed(2)} <span className="text-lg">{fmtCurrency}</span>
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">
                      {t('New total', 'المجموع الجديد')}: <span className="font-bold">{displayTotal.toFixed(2)} {fmtCurrency}</span>
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <motion.button
                      type="button"
                      onClick={handleArrivalOkay}
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 py-3.5 rounded-2xl font-bold text-sm bg-emerald-500 text-white shadow-lg shadow-emerald-300/40 transition-all"
                    >
                      💚 {t('Okay', 'حسناً')}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={handleArrivalRemoveTip}
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 py-3.5 rounded-2xl font-bold text-sm bg-slate-100 text-slate-600 transition-all hover:bg-slate-200"
                    >
                      {t('No, remove tip', 'لا، أزِل الإكرامية')}
                    </motion.button>
                  </div>

                  <p className="text-[10px] text-slate-400 mt-3 text-center leading-relaxed">
                    {arrivalPopupDismissed
                      ? t('Confirm your choice', 'تأكيد اختيارك')
                      : arrivalCountdown != null
                        ? t('Auto-confirms in', 'التأكيد التلقائي خلال') + ` ${arrivalCountdown}s`
                        : t('This will auto-confirm in 30 seconds', 'سيتم التأكيد تلقائياً بعد 30 ثانية')}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ REMOVE TIP REASON MODAL ═══ */}
        <AnimatePresence>
          {showRemoveReason && (() => {
            const wordCount = removeReason.trim().split(/\s+/).filter(Boolean).length
            const hasEnoughWords = wordCount >= 5
            const canSubmit = hasEnoughWords && acknowledgeChecked && !removeSending
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                onClick={() => { setShowRemoveReason(false); setAcknowledgeChecked(false); setArrivalPopupVisible(true) }}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="bg-gradient-to-b from-amber-500 to-amber-600 px-6 pt-5 pb-4 text-white relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 text-white/10 pointer-events-none">
                      <AlertTriangle className="w-24 h-24" />
                    </div>
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-6 h-6 shrink-0" />
                      <h3 className="text-lg font-black">
                        {t('Why remove the tip?', 'لماذا تريد إزالة الإكرامية؟')}
                      </h3>
                    </div>
                    <p className="text-sm text-white/80 mt-1">
                      {t(
                        'The driver arrived on time. Please explain why you changed your mind.',
                        'السائق وصل في الوقت. يرجى توضيح سبب تغيير رأيك.'
                      )}
                    </p>
                  </div>

                  <div className="px-6 py-5 space-y-4">
                    <div>
                      <textarea
                        value={removeReason}
                        onChange={(e) => setRemoveReason(e.target.value)}
                        placeholder={t(
                          'Describe your reason in detail (minimum 5 words)…',
                          'اشرح السبب بالتفصيل (5 كلمات على الأقل)…'
                        )}
                        rows={4}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-amber-300 focus:border-amber-300 focus:outline-none resize-none transition-all"
                      />
                      <div className="flex items-center justify-between mt-1.5 px-1">
                        <p className={`text-[11px] font-medium transition-colors ${hasEnoughWords ? 'text-emerald-500' : 'text-slate-400'}`}>
                          {wordCount}/5 {t('words', 'كلمات')} {hasEnoughWords ? '✓' : ''}
                        </p>
                        {!hasEnoughWords && removeReason.trim().length > 0 && (
                          <p className="text-[11px] text-amber-500 font-medium">
                            {t(`${5 - wordCount} more word${5 - wordCount > 1 ? 's' : ''} needed`, `${5 - wordCount > 1 ? 'تحتاج' : 'تحتاج'} ${5 - wordCount} كلمات أخرى`)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-amber-50 border border-amber-200/60 p-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 leading-relaxed">
                          {t(
                            'Your response will be reviewed by our team. Tip removal requests are taken seriously and may be investigated to ensure fair treatment for both customers and drivers. Depending on the outcome, this may impact the driver\'s profile status on our platform.',
                            'سيتم مراجعة ردك من قبل فريقنا. طلبات إزالة الإكرامية تؤخذ على محمل الجد وقد يتم التحقيق فيها لضمان المعاملة العادلة للعملاء والسائقين. بناءً على النتائج، قد يؤثر ذلك على حالة ملف السائق على منصتنا.'
                          )}
                        </p>
                      </div>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative mt-0.5 shrink-0">
                        <input
                          type="checkbox"
                          checked={acknowledgeChecked}
                          onChange={(e) => setAcknowledgeChecked(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-5 h-5 rounded-md border-2 border-slate-300 bg-white transition-all peer-checked:border-amber-500 peer-checked:bg-amber-500 group-hover:border-amber-400 flex items-center justify-center">
                          {acknowledgeChecked && (
                            <motion.svg
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                              className="w-3.5 h-3.5 text-white"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={3}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </motion.svg>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-slate-600 leading-relaxed">
                        {t(
                          'I have read and understand the above notice. I confirm that my reason is genuine and I accept that this report will be reviewed.',
                          'لقد قرأت وفهمت الملاحظة أعلاه. أؤكد أن سببي حقيقي وأوافق على أنه سيتم مراجعة هذا التقرير.'
                        )}
                      </span>
                    </label>

                    <div className="flex gap-3">
                      <motion.button
                        type="button"
                        onClick={submitRemoveReason}
                        disabled={!canSubmit}
                        whileTap={canSubmit ? { scale: 0.95 } : {}}
                        className={`flex-1 py-3.5 rounded-2xl font-bold text-sm shadow-lg transition-all ${
                          canSubmit
                            ? 'bg-red-500 text-white shadow-red-300/30 active:bg-red-600'
                            : 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
                        }`}
                      >
                        {removeSending
                          ? t('Submitting…', 'جاري الإرسال…')
                          : t('Confirm & Remove Tip', 'تأكيد وإزالة الإكرامية')}
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={() => { setShowRemoveReason(false); setAcknowledgeChecked(false); setArrivalPopupVisible(true) }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 py-3.5 rounded-2xl font-bold text-sm bg-slate-100 text-slate-600 transition-all hover:bg-slate-200"
                      >
                        {t('Go back', 'رجوع')}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )
          })()}
        </AnimatePresence>

        {/* ═══ SECTION 4: DRIVER (collapsible) ═══ */}
        {driver && (
          <div className="border-t border-purple-200/40 bg-purple-50/40">
            <button
              type="button"
              onClick={() => setDriverInfoOpen(!driverInfoOpen)}
              className="w-full flex items-center justify-between px-5 py-3.5 focus:outline-none"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                  <Truck className="h-4 w-4" />
                </div>
                <span className="font-bold text-purple-900 text-sm">{driver.name}</span>
                <span className="text-[11px] text-purple-400 font-medium">
                  — {t('your driver', 'سائقك')}
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 text-purple-400 transition-transform duration-300 ${driverInfoOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {driverInfoOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4 flex flex-wrap gap-2">
                    <a
                      href={`tel:+${normalizePhoneForWhatsApp(driver.phoneNumber, countryCode)}`}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 text-sm min-h-[48px] shadow-sm transition-colors"
                    >
                      <Phone className="h-4 w-4" />
                      {t('Call', 'اتصال')}
                    </a>
                    {getWhatsAppUrl(driver.phoneNumber, '', countryCode) && (
                      <a
                        href={getWhatsAppUrl(driver.phoneNumber, '', countryCode)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-3 text-sm min-h-[48px] shadow-sm transition-colors"
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </a>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

      </div>
    </div>
  )
}

const STATUS_CONFIG: Record<string, { labelEn: string; labelAr: string; icon: typeof ChefHat; headerBg: string; headerFrom: string; headerTo: string }> = {
  new: { labelEn: 'Order received', labelAr: 'تم استلام الطلب', icon: Package, headerBg: 'from-blue-600 to-blue-700', headerFrom: 'from-blue-600', headerTo: 'to-blue-700' },
  acknowledged: { labelEn: 'Order scheduled', labelAr: 'تم جدولة الطلب', icon: Clock, headerBg: 'from-purple-600 to-purple-700', headerFrom: 'from-purple-600', headerTo: 'to-purple-700' },
  preparing: { labelEn: 'Your order is being carefully prepared', labelAr: 'يتم تحضير طلبك بعناية', icon: ChefHat, headerBg: 'from-amber-600 to-amber-700', headerFrom: 'from-amber-600', headerTo: 'to-amber-700' },
  ready_for_pickup: { labelEn: 'Ready for pickup!', labelAr: 'طلبك جاهز للاستلام!', icon: Package, headerBg: 'from-emerald-500 to-emerald-600', headerFrom: 'from-emerald-500', headerTo: 'to-emerald-600' },
  waiting_for_delivery: { labelEn: 'Waiting for delivery', labelAr: 'في انتظار التوصيل', icon: Clock, headerBg: 'from-amber-600 to-amber-700', headerFrom: 'from-amber-600', headerTo: 'to-amber-700' },
  driver_on_the_way: { labelEn: 'Driver on the way to the store', labelAr: 'السائق في الطريق إلى المتجر', icon: Truck, headerBg: 'from-blue-600 to-blue-700', headerFrom: 'from-blue-600', headerTo: 'to-blue-700' },
  'out-for-delivery': { labelEn: 'Driver on the way to you', labelAr: 'السائق في الطريق إليك', icon: Truck, headerBg: 'from-purple-600 to-purple-700', headerFrom: 'from-purple-600', headerTo: 'to-purple-700' },
  completed: { labelEn: 'Completed', labelAr: 'مكتمل', icon: CheckCircle2, headerBg: 'from-emerald-600 to-emerald-700', headerFrom: 'from-emerald-600', headerTo: 'to-emerald-700' },
  served: { labelEn: 'Served', labelAr: 'تم التقديم', icon: UtensilsCrossed, headerBg: 'from-emerald-600 to-emerald-700', headerFrom: 'from-emerald-600', headerTo: 'to-emerald-700' },
  cancelled: { labelEn: 'Cancelled', labelAr: 'ملغى', icon: Clock, headerBg: 'from-red-600 to-red-700', headerFrom: 'from-red-600', headerTo: 'to-red-700' },
  refunded: { labelEn: 'Refunded', labelAr: 'مسترد', icon: CheckCircle2, headerBg: 'from-slate-600 to-slate-700', headerFrom: 'from-slate-600', headerTo: 'to-slate-700' },
}

const DEFAULT_COUNTRY_CODE = '972'

/** Compute 3 round-up-to-nearest-5 tip suggestions based on the total (incl. delivery). */
function getSuggestedTips(total: number): [number, number, number] {
  let next5 = Math.ceil(total / 5) * 5
  let base = next5 - total
  if (base < 2) {
    next5 += 5
    base = next5 - total
  }
  return [Math.round(base * 100) / 100, Math.round((base + 5) * 100) / 100, Math.round((base + 10) * 100) / 100]
}

export function OrderTrackView({ slug, token, orderId, phone }: { slug: string; token?: string; orderId?: string; phone?: string }) {
  const { t, lang } = useLanguage()
  const { showToast } = useToast()
  const [data, setData] = useState<TrackData | null>(null)
  const prevRequestAckRef = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [reportTarget, setReportTarget] = useState<'business' | 'driver' | null>(null)
  const [requestSending, setRequestSending] = useState(false)
  const [showCheckModal, setShowCheckModal] = useState(false)
  const [tipEnabled, setTipEnabled] = useState(false)
  const [selectedTipAmount, setSelectedTipAmount] = useState(0)
  const [tipSending, setTipSending] = useState(false)
  const [splitPeople, setSplitPeople] = useState(1)
  const [showSplitModal, setShowSplitModal] = useState(false)
  const [splitExpanded, setSplitExpanded] = useState(false)
  const [restaurantOpen, setRestaurantOpen] = useState(false)
  const [driverOpen, setDriverOpen] = useState(false)
  const [changeResponseSending, setChangeResponseSending] = useState(false)
  const [showEditOrder, setShowEditOrder] = useState(false)
  const [editItems, setEditItems] = useState<Array<{ _key?: string; productId?: string; productName?: string; quantity?: number; price?: number; total?: number; imageUrl?: string }>>([])
  const [addProductFormOpen, setAddProductFormOpen] = useState(false)
  const [orderSearchQuery, setOrderSearchQuery] = useState('')
  const [orderSearchProducts, setOrderSearchProducts] = useState<Array<{ _id: string; title_en: string; title_ar: string; price: number; currency: string; imageUrl: string }>>([])
  const [orderSearchLoading, setOrderSearchLoading] = useState(false)
  const [orderSelectedProductId, setOrderSelectedProductId] = useState<string | null>(null)
  const [editOrderSaving, setEditOrderSaving] = useState(false)
  const [showBrowseMenu, setShowBrowseMenu] = useState(false)
  // Real-time driver GPS received directly from Pusher — overrides Sanity data while active
  const [liveDriverLocation, setLiveDriverLocation] = useState<{ lat: number; lng: number } | null>(null)

  const fetchTrack = useCallback(async (isRefetch = false) => {
    if (!slug) return
    if (!token?.trim() && !orderId) return

    const fetchUrl = token
      ? `/api/tenants/${slug}/track/${encodeURIComponent(token)}`
      : `/api/tenants/${slug}/order/${orderId}/track`
      
    if (!isRefetch) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch(fetchUrl, { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 404) setError(t('Order not found or link expired.', 'الطلب غير موجود أو انتهت صلاحية الرابط.'))
        else setError(t('Something went wrong.', 'حدث خطأ ما.'))
        setData(null)
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      if (!isRefetch) setError(t('Failed to load order.', 'فشل تحميل الطلب.'))
      if (!isRefetch) setData(null)
    } finally {
      if (!isRefetch) setLoading(false)
    }
  }, [slug, token, orderId, t])

  useEffect(() => {
    fetchTrack(false)
  }, [fetchTrack])

  useEffect(() => {
    if (data?.order) {
      const hasTip = (data.order.tipAmount ?? 0) > 0
      setTipEnabled(hasTip)
      if ((data.order.tipAmount ?? 0) > 0) setSelectedTipAmount(data.order.tipAmount ?? 0)
    }
  }, [data?.order?._id, data?.order?.tipAmount])

  // Toast when staff acknowledges table request (waiter on the way)
  useEffect(() => {
    const ack = data?.order?.customerRequestAcknowledgedAt ?? null
    if (ack && prevRequestAckRef.current !== ack) {
      prevRequestAckRef.current = ack
      showToast(
        t('Waiter is on the way.', 'النادل في الطريق إليك.'),
        t('Waiter is on the way.', 'النادل في الطريق إليك.'),
        'success'
      )
    }
    if (!ack) prevRequestAckRef.current = null
  }, [data?.order?.customerRequestAcknowledgedAt, showToast, t])

  const isDeliveryActive = data?.order?.status === 'out-for-delivery'
  const isOutForDelivery = data?.order?.status === 'out-for-delivery'
  const isDineIn = data?.order?.orderType === 'dine-in'
  const tableNumber = data?.order?.tableNumber ?? ''
  const subtotal = data?.order?.subtotal ?? 0
  const totalAmount = data?.order?.totalAmount ?? 0
  const currency = data?.order?.currency ?? 'ILS'
  const tipAmount = tipEnabled ? selectedTipAmount : 0
  const displayTotal = totalAmount + tipAmount
  const perPerson = splitPeople > 0 ? displayTotal / splitPeople : displayTotal

  // Auto-initialize split count from group participants when order data loads.
  const groupParticipantsCount = data?.order?.groupParticipantsCount ?? null
  useEffect(() => {
    if (groupParticipantsCount && groupParticipantsCount > 1) {
      setSplitPeople(groupParticipantsCount)
      setSplitExpanded(true)
    }
  }, [groupParticipantsCount])

  /** URL token or token returned from Clerk order-by-id API — required for /track/... API routes */
  const effectiveTrackingToken = (token?.trim() || data?.order?.trackingToken || '').trim()

  const sendRequest = async (type: 'call_waiter' | 'request_check', paymentMethod?: 'cash' | 'card') => {
    if (!effectiveTrackingToken || requestSending) return
    setRequestSending(true)
    try {
      const res = await fetch(`/api/tenants/${slug}/track/${encodeURIComponent(effectiveTrackingToken)}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, paymentMethod }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Request failed')
      }
      setShowCheckModal(false)
      showToast(
        t('Request sent. Staff will be with you shortly.', 'تم إرسال الطلب. الطاقم في الطريق إليك.'),
        t('Request sent. Staff will be with you shortly.', 'تم إرسال الطلب. الطاقم في الطريق إليك.'),
        'success'
      )
      fetchTrack(true)
    } catch (e) {
      showToast(
        t('Could not send request. Please try again.', 'تعذر إرسال الطلب. حاول مرة أخرى.'),
        t('Could not send request. Please try again.', 'تعذر إرسال الطلب. حاول مرة أخرى.'),
        'error'
      )
    } finally {
      setRequestSending(false)
    }
  }

  const saveTip = async (amount: number) => {
    if (!effectiveTrackingToken) return
    try {
      await fetch(`/api/tenants/${slug}/track/${encodeURIComponent(effectiveTrackingToken)}/tip`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipPercent: 0, tipAmount: amount }),
      })
      fetchTrack(true)
    } catch {
      // could toast
    }
  }

  const handleTipToggle = (enabled: boolean) => {
    setTipEnabled(enabled)
    if (enabled) {
      const suggestions = getSuggestedTips(totalAmount)
      const amount = suggestions[0]
      setSelectedTipAmount(amount)
      saveTip(amount)
    } else {
      setSelectedTipAmount(0)
      saveTip(0)
    }
  }

  const handleTipAmountChange = (amount: number) => {
    setSelectedTipAmount(amount)
    if (tipEnabled) {
      saveTip(amount)
    }
  }

  const respondToItemChanges = async (action: 'approve' | 'contact_request') => {
    if (!effectiveTrackingToken || changeResponseSending) return
    setChangeResponseSending(true)
    try {
      const res = await fetch(`/api/tenants/${slug}/track/${encodeURIComponent(effectiveTrackingToken)}/item-changes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          note: action === 'contact_request'
            ? t('Please contact me for alternatives before finalizing.', 'يرجى التواصل معي لبدائل قبل اعتماد التغييرات.')
            : undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      showToast(
        action === 'approve'
          ? t('Changes confirmed. Thank you!', 'تم تأكيد التغييرات. شكراً!')
          : t('Driver notified. They will contact you shortly.', 'تم إشعار السائق. سيتواصل معك قريباً.'),
        action === 'approve'
          ? t('Changes confirmed. Thank you!', 'تم تأكيد التغييرات. شكراً!')
          : t('Driver notified. They will contact you shortly.', 'تم إشعار السائق. سيتواصل معك قريباً.'),
        'success'
      )
      fetchTrack(true)
    } catch {
      showToast(
        t('Could not submit your response. Please try again.', 'تعذر إرسال ردك. حاول مرة أخرى.'),
        t('Could not submit your response. Please try again.', 'تعذر إرسال ردك. حاول مرة أخرى.'),
        'error'
      )
    } finally {
      setChangeResponseSending(false)
    }
  }

  const openEditOrder = async () => {
    if (!data?.order?.items?.length || !slug || !effectiveTrackingToken) return
    try {
      await fetch(`/api/tenants/${slug}/track/${encodeURIComponent(effectiveTrackingToken)}/customer-edit-started`, { method: 'POST' })
    } catch {
      // non-blocking
    }
    setEditItems(
      (data.order.items ?? []).map((item) => ({
        _key: item._key,
        productId: item.productId,
        productName: item.productName ?? '',
        quantity: item.quantity ?? 1,
        price: item.price ?? 0,
        total: item.total ?? (item.price ?? 0) * (item.quantity ?? 1),
        imageUrl: item.imageUrl,
      }))
    )
    setAddProductFormOpen(false)
    setOrderSearchQuery('')
    setOrderSearchProducts([])
    setOrderSelectedProductId(null)
    setShowEditOrder(true)
  }

  const loadOrderProducts = useCallback(
    async (query: string) => {
      if (!slug || !effectiveTrackingToken) return
      setOrderSearchLoading(true)
      try {
        const params = new URLSearchParams()
        if (query.trim()) params.set('q', query.trim())
        const res = await fetch(
          `/api/tenants/${slug}/track/${encodeURIComponent(effectiveTrackingToken)}/order-products?${params.toString()}`,
          { cache: 'no-store' }
        )
        if (!res.ok) return
        const json = await res.json()
        setOrderSearchProducts(Array.isArray(json.products) ? json.products : [])
      } finally {
        setOrderSearchLoading(false)
      }
    },
    [slug, effectiveTrackingToken]
  )

  const updateEditItemQty = (index: number, delta: number) => {
    setEditItems((prev) => {
      const next = [...prev]
      const item = next[index]
      if (!item) return prev
      const qty = Math.max(1, (item.quantity ?? 1) + delta)
      const price = item.price ?? 0
      next[index] = { ...item, quantity: qty, total: price * qty }
      return next
    })
  }

  const removeEditItem = (index: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== index))
  }

  const addProductToEdit = (product: { _id?: string; productId?: string; title_en: string; title_ar: string; price: number; currency: string; imageUrl?: string }) => {
    const id = product.productId ?? product._id
    const name = lang === 'ar' ? product.title_ar : product.title_en
    setEditItems((prev) => [
      ...prev,
      {
        _key: `customer-add-${Date.now()}`,
        productId: id,
        productName: name,
        quantity: 1,
        price: product.price,
        total: product.price,
        imageUrl: product.imageUrl,
      },
    ])
    setOrderSelectedProductId(null)
    setOrderSearchProducts([])
    setOrderSearchQuery('')
    setAddProductFormOpen(false)
  }

  const submitEditOrder = async () => {
    if (!slug || !effectiveTrackingToken || !data?.order || editItems.length === 0 || editOrderSaving) return
    setEditOrderSaving(true)
    try {
      const res = await fetch(`/api/tenants/${slug}/track/${encodeURIComponent(effectiveTrackingToken)}/customer-edit-order`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: editItems.map((item) => ({
            _key: item._key,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity ?? 1,
            price: item.price ?? 0,
            total: (item.price ?? 0) * (item.quantity ?? 1),
          })),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      showToast(
        t('Cart updated. Driver was notified to approve.', 'تم تحديث السلة. تم إشعار السائق للموافقة.'),
        t('Cart updated. Driver was notified to approve.', 'تم تحديث السلة. تم إشعار السائق للموافقة.'),
        'success'
      )
      setShowEditOrder(false)
      fetchTrack(true)
    } catch {
      showToast(
        t('Could not update cart. Please try again.', 'تعذر تحديث السلة. حاول مرة أخرى.'),
        t('Could not update cart. Please try again.', 'تعذر تحديث السلة. حاول مرة أخرى.'),
        'error'
      )
    } finally {
      setEditOrderSaving(false)
    }
  }

  const sendTipToDriver = async () => {
    if (!effectiveTrackingToken || tipSending || tipAmount <= 0) return
    setTipSending(true)
    try {
      const res = await fetch(`/api/tenants/${slug}/track/${encodeURIComponent(effectiveTrackingToken)}/tip-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipPercent: 0, tipAmount }),
      })
      if (!res.ok) throw new Error('Failed')
      showToast(
        t('Tip sent to driver!', 'تم إرسال الإكرامية للسائق!'),
        t('Tip sent to driver!', 'تم إرسال الإكرامية للسائق!'),
        'success'
      )
      fetchTrack(true)
    } catch {
      showToast(
        t('Could not send tip. Try again.', 'تعذّر إرسال الإكرامية. حاول مرة أخرى.'),
        t('Could not send tip. Try again.', 'تعذّر إرسال الإكرامية. حاول مرة أخرى.'),
        'error'
      )
    } finally {
      setTipSending(false)
    }
  }

  const confirmTipAfterCountdown = async (keep: boolean) => {
    if (!effectiveTrackingToken) return
    try {
      await fetch(`/api/tenants/${slug}/track/${encodeURIComponent(effectiveTrackingToken)}/tip`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipPercent: 0,
          tipAmount: keep ? tipAmount : 0,
          tipConfirmedAfterCountdown: keep,
        }),
      })
      if (!keep) {
        setTipEnabled(false)
      }
      fetchTrack(true)
      showToast(
        keep
          ? t('Tip kept — the driver will appreciate it!', 'تم الاحتفاظ بالإكرامية — السائق سيقدّر ذلك!')
          : t('Tip removed.', 'تمت إزالة الإكرامية.'),
        keep
          ? t('Tip kept — the driver will appreciate it!', 'تم الاحتفاظ بالإكرامية — السائق سيقدّر ذلك!')
          : t('Tip removed.', 'تمت إزالة الإكرامية.'),
        keep ? 'success' : 'info'
      )
    } catch {}
  }

  const confirmTipIncludedInTotal = async (keep: boolean, reason?: string) => {
    if (!effectiveTrackingToken) return
    try {
      const res = await fetch(`/api/tenants/${slug}/track/${encodeURIComponent(effectiveTrackingToken)}/tip`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipIncludedInTotal: keep,
          ...(keep ? {} : { tipPercent: 0, tipAmount: 0 }),
          ...(reason ? { removeTipReason: reason } : {}),
        }),
      })
      if (!res.ok) throw new Error('Update failed')
      if (!keep) {
        setTipEnabled(false)
      }
      fetchTrack(true)
      showToast(
        keep
          ? t('Tip added to total! The driver will see the updated amount.', 'تمت إضافة الإكرامية للمجموع! السائق سيرى المبلغ المحدّث.')
          : t('Tip removed.', 'تمت إزالة الإكرامية.'),
        keep
          ? t('Tip added to total! The driver will see the updated amount.', 'تمت إضافة الإكرامية للمجموع! السائق سيرى المبلغ المحدّث.')
          : t('Tip removed.', 'تمت إزالة الإكرامية.'),
        keep ? 'success' : 'info'
      )
    } catch {
      showToast(
        t('Could not update tip. Please try again.', 'تعذّر تحديث الإكرامية. حاول مرة أخرى.'),
        t('Could not update tip. Please try again.', 'تعذّر تحديث الإكرامية. حاول مرة أخرى.'),
        'error'
      )
    }
  }

  // Order status updates — triggers a full Sanity refetch for authoritative data
  usePusherStream(
    data?.order?._id ? `order-${data.order._id}` : null,
    'order-update',
    () => fetchTrack(true)
  )

  // Live driver GPS — data arrives directly from Pusher, no Sanity round-trip.
  // Only active when driver is en-route (driver_on_the_way or out-for-delivery).
  const isDriverEnRoute =
    data?.order?.status === 'driver_on_the_way' || data?.order?.status === 'out-for-delivery'

  // Auth params for the private Pusher channel.
  // The tracking token (from the URL or order payload) proves the customer owns this order.
  const pusherAuthParams = useMemo(
    () =>
      data?.order?._id && effectiveTrackingToken
        ? { tracking_token: effectiveTrackingToken, order_id: data.order._id }
        : undefined,
    [effectiveTrackingToken, data?.order?._id]
  )

  const isLive = usePusherSubscription<{ lat: number; lng: number }>(
    data?.order?._id ? `private-driver-location-${data.order._id}` : null,
    'location-update',
    useCallback((coords) => {
      setLiveDriverLocation(coords)
    }, []),
    { enabled: isDriverEnRoute, authParams: pusherAuthParams }
  )

  const trackUrl =
    typeof window !== 'undefined' && effectiveTrackingToken
      ? `${window.location.origin}/t/${slug}/track/${effectiveTrackingToken}`
      : ''

  const copyTrackLink = () => {
    if (!trackUrl) return
    navigator.clipboard.writeText(trackUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const countryCode = data?.country === 'IL' || data?.country === 'Israel' ? '972' : DEFAULT_COUNTRY_CODE

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-lg min-h-screen bg-slate-50/50 pb-24 animate-pulse">
        {/* Header Skeleton */}
        <div className="h-40 rounded-b-3xl bg-slate-200" />
        
        {/* Map / ETA Skeleton */}
        <div className="mt-4 px-4">
          <div className="h-32 rounded-3xl bg-slate-200" />
        </div>

        {/* Content Skeleton */}
        <div className="mt-6 px-4 space-y-4">
          <div className="h-40 rounded-3xl bg-slate-200" />
          <div className="h-24 rounded-3xl bg-slate-200" />
          <div className="h-16 rounded-3xl bg-slate-200" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm max-w-md">
          <Package className="mx-auto h-14 w-14 text-slate-300" />
          <h1 className="mt-4 text-xl font-bold text-slate-800">{t('Order not found', 'الطلب غير موجود')}</h1>
          <p className="mt-2 text-slate-500">{error}</p>
          <Link href={`/t/${slug}`} className="mt-4 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700">
            {t('Back to menu', 'العودة إلى القائمة')}
          </Link>
        </div>
      </div>
    )
  }

  const isDelivery = data.order.orderType === 'delivery'
  const isPickup = !isDelivery && !isDineIn
  const isTerminal = ['completed', 'served', 'cancelled', 'refunded'].includes(data.order.status ?? '')
  const rawStatusKey = (data.order.status || 'new') as keyof typeof STATUS_CONFIG
  const statusKey: keyof typeof STATUS_CONFIG = (() => {
    if (isDelivery) return rawStatusKey
    const st = data.order.status || 'new'
    if (st === 'waiting_for_delivery') return isPickup ? 'ready_for_pickup' : 'preparing'
    if (['driver_on_the_way', 'out-for-delivery'].includes(st)) return 'preparing'
    return rawStatusKey
  })()
  const statusCfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.new
  const StatusIcon = statusCfg.icon
  const businessName = (lang === 'ar' ? data.restaurant?.name_ar : data.restaurant?.name_en) || data.restaurant?.name_en || data.restaurant?.name_ar || ''
  const restaurantName = businessName || t('Store', 'المتجر')
  const statusLabel = (() => {
    if (statusKey === 'driver_on_the_way') {
      return data.driver?.name
        ? lang === 'ar'
          ? `السائق ${data.driver.name} في الطريق إلى ${restaurantName}`
          : `Driver ${data.driver.name} is on the way to ${restaurantName}`
        : lang === 'ar'
          ? `السائق في الطريق إلى ${restaurantName}`
          : `Driver is on the way to ${restaurantName}`
    }
    if (statusKey === 'out-for-delivery') {
      return data.driver?.name
        ? lang === 'ar' ? `${data.driver.name} في الطريق إليك` : `${data.driver.name} is on the way to you`
        : lang === 'ar' ? `السائق في الطريق إليك` : `Driver is on the way to you`
    }
    if (statusKey === 'new') {
      return lang === 'ar' ? `تم إرسال الطلب إلى ${restaurantName}` : `Order sent to ${restaurantName}`
    }
    if (statusKey === 'served' && isDineIn) {
      return lang === 'ar' ? 'بالعافية!' : 'Enjoy your meal!'
    }
    if (statusKey === 'completed') {
      if (isDineIn) return lang === 'ar' ? 'شكراً لزيارتك!' : 'Thank you for your visit!'
      if (isPickup) return lang === 'ar' ? 'تم الاستلام بنجاح!' : 'Picked up successfully!'
      return lang === 'ar' ? statusCfg.labelAr : statusCfg.labelEn
    }
    return lang === 'ar' ? statusCfg.labelAr : statusCfg.labelEn
  })()
  const deliveryFee = data.order.deliveryFee ?? 0
  const deliveryFeePaidByBusiness = data.order.deliveryFeePaidByBusiness === true
  const shopperFee = data.order.shopperFee ?? 0
  const hasPendingItemChangeConfirmation = data.order.customerItemChangeStatus === 'pending'
  const pickedItemsCount = (data.order.items ?? []).filter((item) => item.isPicked !== false).length
  const notPickedItemsCount = (data.order.items ?? []).filter((item) => item.isPicked === false).length

  const hasPendingTipConfirmation =
    isDelivery &&
    !!data.order.driverArrivedAt &&
    !!data.order.tipSentToDriver &&
    (data.order.tipAmount ?? 0) > 0 &&
    !data.order.tipIncludedInTotal &&
    !data.order.tipRemovedByDriver

  return (
    <CustomerTrackPushGate slug={slug} token={effectiveTrackingToken || token || ''} forceBypass={hasPendingTipConfirmation}>
    <div className="relative mx-auto max-w-lg pb-32">
      <Link
        href={`/t/${slug}`}
        className="fixed z-[60] inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg ring-1 ring-black/5 hover:bg-slate-50 transition-colors left-4 top-[max(1rem,calc(env(safe-area-inset-top,0px)+0.5rem))] rtl:left-auto rtl:right-4"
        aria-label={t('Back to menu', 'العودة إلى القائمة')}
      >
        <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
      </Link>

      {/* Status as main headline + dynamic header */}
      <div className={`rounded-b-[2.5rem] bg-gradient-to-b ${statusCfg.headerBg} px-6 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-14 text-white shadow-sm`}>
        <div className="flex items-center justify-center gap-3">
          <StatusIcon className="h-9 w-9 shrink-0 opacity-95" />
          <h1 className="text-2xl font-black text-center">
            {statusLabel}
          </h1>
        </div>
        <p className="mt-2 text-center text-white/90 flex items-center justify-center gap-2">
          {t('Order', 'الطلب')} #{data.order.orderNumber ?? data.order._id?.slice(-6)}
          {isDriverEnRoute && isLive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
              {t('Live', 'مباشر')}
            </span>
          )}
        </p>
        {isDineIn && tableNumber && (
          <p className="mt-1 text-center text-white/70 text-sm font-medium">
            {t('Table', 'طاولة')} {tableNumber}
          </p>
        )}
        {isPickup && (
          <p className="mt-1 text-center text-white/70 text-sm font-medium">
            {t('Pickup order', 'طلب استلام')}
          </p>
        )}
      </div>

      {/* Live driver tracking map — shown during delivery for any delivery order with a driver assigned */}
      {isDelivery && isDriverEnRoute && data.driver && (
        <div className="px-4 -mt-6 relative z-10 mb-2">
          <div className="rounded-[2rem] overflow-hidden shadow-sm border border-slate-200/80 bg-white h-[220px]">
            <CustomerTrackingMap
              orderId={data.order._id}
              driverLat={liveDriverLocation?.lat ?? data.driver.lat ?? null}
              driverLng={liveDriverLocation?.lng ?? data.driver.lng ?? null}
              deliveryLat={data.order.deliveryLat ?? null}
              deliveryLng={data.order.deliveryLng ?? null}
              restaurantLat={data.businessLocation?.lat ?? null}
              restaurantLng={data.businessLocation?.lng ?? null}
              driverName={data.driver.name}
              restaurantName={restaurantName}
              orderStatus={data.order.status as 'driver_on_the_way' | 'out-for-delivery'}
              isLive={isLive}
              lang={lang as 'en' | 'ar'}
            />
          </div>
        </div>
      )}

      {/* Delivery ETA / Countdown + Price + Tip unified box */}
      <DeliveryETABox
        order={data.order}
        driver={data.driver}
        countryCode={countryCode}
        tipEnabled={tipEnabled}
        selectedTipAmount={selectedTipAmount}
        tipAmount={tipAmount}
        displayTotal={displayTotal}
        totalAmount={totalAmount}
        currency={currency}
        onTipToggle={handleTipToggle}
        onTipAmountChange={handleTipAmountChange}
        onSendTipToDriver={sendTipToDriver}
        onConfirmTipAfterCountdown={confirmTipAfterCountdown}
        onConfirmTipIncludedInTotal={confirmTipIncludedInTotal}
        tipSending={tipSending}
      />

      {isDelivery && data.order.shopperFee != null && (
        <div className="mt-5 px-4">
          <div className="rounded-[2rem] border border-indigo-200/70 bg-indigo-50 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-indigo-100/80">
              <h2 className="font-bold text-indigo-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-500" />
                {t('Personal shopper updates', 'تحديثات المتسوق الشخصي')}
              </h2>
              <p className="text-xs text-indigo-700 mt-1">
                {t('If an item is unavailable, your driver may send replacements for approval.', 'إذا كان صنف غير متوفر، قد يرسل السائق بدائل للموافقة.')}
              </p>
            </div>

            <div className="px-5 py-4 space-y-4">
              {hasPendingItemChangeConfirmation && (
                <>
                  <motion.div
                    className="relative rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-amber-100/80 overflow-hidden shadow-lg shadow-amber-200/50"
                    initial={{ opacity: 1, scale: 1 }}
                    animate={{
                      opacity: [1, 0.94, 1],
                      scale: [1, 1.015, 1],
                    }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
                      <Package className="w-32 h-32 text-amber-300/40" />
                    </div>
                    <div className="relative z-10 px-4 py-4">
                      <p className="text-lg font-black text-amber-900">
                        {t('Action needed: confirm item changes', 'إجراء مطلوب: تأكيد تغييرات الأصناف')}
                      </p>
                      <p className="text-sm text-amber-800 mt-1.5 font-medium">
                        {t('Your order total changed based on updated available items.', 'تم تعديل إجمالي الطلب بناءً على الأصناف المتوفرة.')}
                      </p>
                    </div>
                  </motion.div>

                  {(data.order.customerItemChangeSummary ?? []).length > 0 && (
                    <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 space-y-4">
                      {(data.order.customerItemChangeSummary ?? []).map((change, idx) => {
                        const fromName = change.fromName || t('Item', 'صنف')
                        const toName = change.toName || fromName
                        const fromQty = change.fromQuantity ?? 1
                        const toQty = change.toQuantity ?? 1
                        const isQtyChange = change.type === 'edited' && fromQty !== toQty && fromName === toName
                        const newProductItem = (data.order.items ?? []).find(
                          (item) => item.productName && (item.productName === toName || item.productName === change.toName)
                        )
                        const imageUrl = newProductItem?.imageUrl
                        const price = newProductItem?.price ?? 0
                        const currency = data.order.currency ?? 'ILS'

                        if (change.type === 'removed' || change.type === 'not_picked') {
                          return (
                            <div key={`${change.type}-${idx}`} className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 flex gap-4 items-center">
                              <div className="shrink-0 w-14 h-14 rounded-xl bg-rose-100 flex items-center justify-center">
                                <Trash2 className="w-8 h-8 text-rose-500" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-rose-600 uppercase tracking-wide">
                                  {change.type === 'removed' ? t('Removed', 'تمت الإزالة') : t('Not picked', 'لم يتم التقاطه')}
                                </p>
                                <p className="text-base font-bold text-slate-800 line-through mt-0.5">{fromName}</p>
                                {fromQty > 1 && <p className="text-sm text-slate-500">{t('Qty', 'الكمية')}: {fromQty}</p>}
                                {(change.note || '').trim() && <p className="text-sm text-slate-500 mt-1">📝 {change.note}</p>}
                              </div>
                            </div>
                          )
                        }

                        if (change.type === 'replaced') {
                          return (
                            <div key={`replaced-${idx}`} className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
                              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide flex items-center gap-1.5">
                                <RefreshCw className="w-3.5 h-3.5" />
                                {t('Replaced', 'تم الاستبدال')}
                              </p>
                              <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-slate-500 line-through truncate">{fromName}</p>
                                  {fromQty > 1 && <p className="text-xs text-slate-400">{fromQty}×</p>}
                                </div>
                                <ArrowRight className="w-6 h-6 text-indigo-400 shrink-0" />
                                <div className="flex-1 flex gap-3 items-center min-w-0">
                                  {imageUrl ? (
                                    <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm">
                                      <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <div className="shrink-0 w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center">
                                      <Package className="w-10 h-10 text-slate-400" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="font-bold text-slate-900 text-base truncate">{toName}</p>
                                    <p className="text-indigo-600 font-bold mt-0.5">
                                      {price.toFixed(2)} {formatCurrency(currency)}
                                      {toQty > 1 && ` × ${toQty}`}
                                    </p>
                                    {(change.note || '').trim() && <p className="text-xs text-slate-500 mt-1">📝 {change.note}</p>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        }

                        if (isQtyChange) {
                          return (
                            <div key={`edited-${idx}`} className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-4 flex gap-4 items-center">
                              {imageUrl ? (
                                <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm">
                                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="shrink-0 w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center">
                                  <Package className="w-10 h-10 text-slate-400" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">{t('Quantity changed', 'تم تغيير الكمية')}</p>
                                <p className="font-bold text-slate-900 text-base mt-0.5">{fromName}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200 text-slate-600 font-bold text-sm">
                                    <Minus className="w-3.5 h-3.5" /> {fromQty}
                                  </span>
                                  <ArrowRight className="w-4 h-4 text-amber-500" />
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-200 text-amber-800 font-bold text-sm">
                                    <Plus className="w-3.5 h-3.5" /> {toQty}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-600 mt-1">
                                  {price.toFixed(2)} {formatCurrency(currency)} {t('each', 'للقطعة')}
                                </p>
                                {(change.note || '').trim() && <p className="text-xs text-slate-500 mt-1">📝 {change.note}</p>}
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div key={`${change.type}-${idx}`} className="flex gap-4 items-start rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                            {imageUrl ? (
                              <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-slate-200">
                                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="shrink-0 w-16 h-16 rounded-xl bg-amber-100 flex items-center justify-center">
                                <Package className="w-8 h-8 text-amber-600/70" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                {change.type === 'edited' && t('Updated', 'تم التحديث')}
                              </p>
                              <p className="font-bold text-slate-800 text-base">{toName}</p>
                              {(change.note || '').trim() && <p className="text-sm text-slate-500 mt-1">📝 {change.note}</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-base">
                    <div className="flex justify-between items-baseline">
                      <span className="font-semibold text-slate-700">{t('Previous total', 'الإجمالي السابق')}</span>
                      <span className="font-bold text-slate-900">{(data.order.customerItemChangePreviousTotalAmount ?? totalAmount).toFixed(2)} {formatCurrency(currency)}</span>
                    </div>
                    <div className="flex justify-between items-baseline mt-2">
                      <span className="font-semibold text-slate-700">{t('New total', 'الإجمالي الجديد')}</span>
                      <span className="text-lg font-black text-indigo-700">{totalAmount.toFixed(2)} {formatCurrency(currency)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <Button
                      onClick={() => respondToItemChanges('approve')}
                      disabled={changeResponseSending}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base py-6"
                    >
                      ✅ {changeResponseSending ? t('Sending...', 'جارٍ الإرسال...') : t('Confirm changes', 'تأكيد التغييرات')}
                    </Button>
                    <Button
                      onClick={() => respondToItemChanges('contact_request')}
                      disabled={changeResponseSending}
                      variant="outline"
                      className="w-full bg-white text-slate-900 border-slate-300 hover:bg-slate-50 font-semibold text-base py-6"
                    >
                      💬 {t('Contact driver for alternatives', 'التواصل مع السائق لبدائل')}
                    </Button>
                  </div>
                </>
              )}

              {!hasPendingItemChangeConfirmation && data.order.customerItemChangeStatus && (
                <div className={`rounded-2xl border px-3.5 py-3 text-sm ${
                  data.order.customerItemChangeStatus === 'driver_declined'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}>
                  {data.order.customerItemChangeStatus === 'approved'
                    ? t('You approved the latest item changes.', 'تمت موافقتك على آخر تغييرات الأصناف.')
                    : data.order.customerItemChangeStatus === 'driver_declined'
                      ? t('Driver declined your order changes. You can edit again or contact the driver.', 'السائق رفض تعديلات الطلب. يمكنك التعديل مرة أخرى أو التواصل مع السائق.')
                      : t('You requested contact with the driver.', 'لقد طلبت التواصل مع السائق.')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dine-in: table number badge */}
      {isDineIn && tableNumber && !isTerminal && (
        <div className="mt-6 px-4">
          <div className="rounded-3xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-5 shadow-sm text-center">
            <UtensilsCrossed className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider mb-1">
              {t('Your table', 'طاولتك')}
            </p>
            <p className="text-4xl font-black text-amber-800">
              {tableNumber}
            </p>
          </div>
        </div>
      )}

      {/* Completed/served state (for all order types) */}
      {(data.order.status === 'completed' || data.order.status === 'served') && (
        <div className="mt-6 px-4">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-emerald-200/40 pointer-events-none">
              <CheckCircle2 className="w-28 h-28" />
            </div>
            <div className="flex items-center gap-3 mb-2 relative z-10">
              <div className="bg-emerald-600 p-2.5 rounded-xl text-white">
                {isDineIn ? <UtensilsCrossed className="w-5 h-5" /> : <Package className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-lg font-black text-emerald-900">
                  {data.order.status === 'served'
                    ? t('Order served', 'تم تقديم الطلب')
                    : isDineIn
                      ? t('Enjoy your meal!', 'بالعافية!')
                      : t('Order completed', 'تم إكمال الطلب')}
                </h2>
                {data.order.completedAt && (
                  <p className="text-sm text-emerald-600">
                    {new Date(data.order.completedAt).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </p>
                )}
              </div>
            </div>
            {(data.order.tipAmount ?? 0) > 0 ? (
              <div className="relative z-10 rounded-2xl bg-emerald-100/80 border border-emerald-200/60 p-3 mt-3">
                <p className="text-center text-sm text-emerald-700 font-medium">
                  💚 {t('Thank you for your generous tip! Your kindness is truly appreciated.', 'شكراً لإكراميتك الكريمة! لطفك موضع تقدير كبير.')}
                </p>
              </div>
            ) : (
              <div className="relative z-10 rounded-2xl bg-amber-50/80 border border-amber-200/60 p-3 mt-3">
                <p className="text-center text-sm text-amber-700 font-medium">
                  {isDineIn
                    ? t('Enjoyed your meal? A small tip next time goes a long way to show your appreciation!', 'استمتعت بوجبتك؟ إكرامية صغيرة في المرة القادمة تعني الكثير!')
                    : t('Enjoyed the service? Consider leaving a tip next time — it means a lot!', 'أعجبتك الخدمة؟ فكّر بإكرامية في المرة القادمة — تعني الكثير!')} 💛
                </p>
              </div>
            )}
            
            {data.order.customer?._ref && (
              <div className="mt-4 relative z-10">
                <OrderRatingPrompt 
                  orderId={data.order._id}
                  raterRole="customer"
                  raterId={data.order.customer._ref}
                  businessDisplayName={restaurantName}
                  driverDisplayName={data.driver?.name}
                  targetName={restaurantName}
                  autoOpen
                  theme="light"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {data.order.scheduledFor && data.order.status !== 'completed' && data.order.status !== 'cancelled' && data.order.status !== 'refunded' && (
        <div className="mt-6 px-4">
          <div className="rounded-3xl border border-purple-200 bg-purple-50 p-5 shadow-sm relative overflow-hidden">
            <div className="absolute -right-6 -top-6 text-purple-200/50 pointer-events-none">
              <Clock className="w-32 h-32" />
            </div>
            <div className="flex items-center gap-3 mb-2 relative z-10">
              <div className="bg-purple-600 p-2 rounded-xl text-white">
                <Clock className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black text-purple-900">
                {t('Scheduled Order', 'طلب مجدول')}
              </h2>
            </div>
            <p className="text-purple-800 font-medium relative z-10">
              {t('Scheduled for:', 'مجدول ليوم:')} {new Date(data.order.scheduledFor).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
            </p>
          </div>
        </div>
      )}

      {/* Order details */}
      <div className="mt-6 px-4">
        <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-400" />
              {t('Activity Timeline', 'سجل النشاطات')}
            </h2>
          </div>
          <div className="p-5">
            {(() => {
              const fmt = (iso: string) =>
                new Date(iso).toLocaleString('en-US', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })
              return (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 rtl:before:ml-0 rtl:before:mr-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                  {/* 1. Order received — always shown */}
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-slate-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                    <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-slate-50 shadow-sm border border-slate-100 flex flex-col">
                      <p className="text-xs font-bold text-slate-800">
                        {lang === 'ar' ? `تم إرسال الطلب إلى ${restaurantName}` : `Order sent to ${restaurantName}`}
                      </p>
                      {data.order.createdAt && <p className="text-xs text-slate-500 mt-1">{fmt(data.order.createdAt)}</p>}
                    </div>
                  </div>

                  {/* Schedule Edits (if any) */}
                  {(data.order.scheduleEditHistory || []).map((edit, idx) => (
                    <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-purple-300 bg-purple-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-purple-50/50 shadow-sm border border-purple-100 flex flex-col">
                        <p className="text-xs font-bold text-purple-800 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {t('Scheduled time updated', 'تم تحديث وقت الجدولة')}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {t('Previously:', 'سابقاً:')} {fmt(edit.previousScheduledFor)}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 border-t border-purple-100 pt-0.5">
                          {fmt(edit.changedAt)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* 2. Order ready (optional) */}
                  {data.order.preparedAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-slate-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-white shadow-sm border border-slate-100 flex flex-col">
                        <p className="text-xs font-bold text-slate-800">{t('Your order is being carefully prepared', 'يتم تحضير طلبك بعناية')}</p>
                        <p className="text-xs text-slate-500 mt-1">{fmt(data.order.preparedAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* 3. Driver on the way to business (delivery only) */}
                  {isDelivery && data.order.driverAcceptedAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-slate-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-white shadow-sm border border-slate-100 flex flex-col">
                        <p className="text-xs font-bold text-slate-800">
                          {data.driver?.name
                            ? lang === 'ar'
                              ? `السائق ${data.driver.name} في الطريق إلى ${restaurantName}`
                              : `Driver ${data.driver.name} is on the way to ${restaurantName}`
                            : lang === 'ar'
                              ? `السائق في الطريق إلى ${restaurantName}`
                              : `Driver is on the way to ${restaurantName}`}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{fmt(data.order.driverAcceptedAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* 4. Order picked up / on the way to client (delivery only) */}
                  {isDelivery && data.order.driverPickedUpAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-slate-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-white shadow-sm border border-slate-100 flex flex-col">
                        <p className="text-xs font-bold text-slate-800">
                          {data.driver?.name
                            ? lang === 'ar'
                              ? `تم استلام الطلب — ${data.driver.name} في الطريق إليك`
                              : `Order picked up — ${data.driver.name} is on the way to you`
                            : t('Order picked up — on the way to you', 'تم استلام الطلب — في الطريق إليك')}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{fmt(data.order.driverPickedUpAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* 4.5 Driver arrived at customer (delivery only) */}
                  {isDelivery && data.order.driverArrivedAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-emerald-300 bg-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-emerald-50/70 shadow-sm border border-emerald-100 flex flex-col">
                        <p className="text-xs font-bold text-emerald-800">
                          {t('Driver has arrived at your location', 'السائق وصل إلى موقعك')}
                        </p>
                        <p className="text-xs text-emerald-600 mt-1">{fmt(data.order.driverArrivedAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* 5. Order completed / served */}
                  {data.order.completedAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-emerald-300 bg-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-emerald-50 shadow-sm border border-emerald-100 flex flex-col">
                        <p className="text-xs font-bold text-emerald-800">
                          {isDelivery
                            ? t('Order delivered', 'تم التوصيل')
                            : isDineIn
                              ? t('Order completed', 'تم إكمال الطلب')
                              : t('Order picked up', 'تم استلام الطلب')}
                        </p>
                        <p className="text-xs text-emerald-600 mt-1">{fmt(data.order.completedAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* Order cancelled */}
                  {data.order.cancelledAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-red-300 bg-red-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-red-50 shadow-sm border border-red-100 flex flex-col">
                        <p className="text-xs font-bold text-red-800">{t('Order cancelled', 'تم إلغاء الطلب')}</p>
                        <p className="text-xs text-red-600 mt-1">{fmt(data.order.cancelledAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* Driver cancelled delivery (delivery only) */}
                  {isDelivery && data.order.driverCancelledAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-amber-300 bg-amber-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-amber-50 shadow-sm border border-amber-100 flex flex-col">
                        <p className="text-xs font-bold text-amber-800">{t('Driver cancelled delivery', 'السائق ألغى التوصيل')}</p>
                        <p className="text-xs text-amber-600 mt-1">{fmt(data.order.driverCancelledAt)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Order details */}
      <div className="mt-6 px-4">
        <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-slate-400" />
              {t('Order details', 'تفاصيل الطلب')}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                ✅ {t('Picked', 'تم التقاطه')}: {pickedItemsCount}
              </span>
              <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                ❌ {t('Not picked', 'غير ملتقط')}: {notPickedItemsCount}
              </span>
            </div>
          </div>
          <ul className="divide-y divide-slate-100/80 px-2">
            {(data.order.items ?? []).map((item, i) => (
              <li key={i} className="flex justify-between gap-4 px-3 py-4 text-sm">
                <div className="min-w-0">
                  <p className={`font-semibold truncate ${item.isPicked === false ? 'text-rose-600 line-through' : 'text-slate-800'}`}>{item.productName}</p>
                  {item.isPicked === false && (
                    <p className="text-xs text-rose-600 mt-1">
                      ❌ {t('Not picked from store (not included in total)', 'غير متوفر ولم يتم التقاطه (غير محسوب في الإجمالي)')}
                      {item.notPickedReason ? ` — ${item.notPickedReason}` : ''}
                    </p>
                  )}
                  {(item.notes || item.addOns) && (
                    <p className="text-xs text-slate-500 mt-1 truncate">{[item.notes, item.addOns].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <span className={`shrink-0 font-medium px-2 py-1 rounded-lg self-start ${item.isPicked === false ? 'text-slate-500 bg-slate-100 line-through' : 'text-slate-600 bg-slate-50'}`}>
                  {item.quantity} × {item.price?.toFixed(2)} {formatCurrency(data.order.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="bg-slate-50/50 px-5 py-4 space-y-2.5">
            <div className="flex justify-between text-slate-600 text-sm">
              <span>{t('Subtotal', 'المجموع الفرعي')}</span>
              <span className="font-medium">{(data.order.subtotal ?? 0).toFixed(2)} {formatCurrency(data.order.currency)}</span>
            </div>
            {isDelivery && (deliveryFee > 0 || deliveryFeePaidByBusiness) && (
              <div className="flex justify-between text-slate-600 text-sm">
                <span>{t('Delivery', 'التوصيل')}</span>
                {deliveryFeePaidByBusiness ? (
                  <span className="font-medium text-emerald-700">{t('FREE', 'مجاناً')}</span>
                ) : (
                  <span className="font-medium">{deliveryFee.toFixed(2)} {formatCurrency(data.order.currency)}</span>
                )}
              </div>
            )}
            {isDelivery && deliveryFeePaidByBusiness && (
              <div className="text-[11px] text-emerald-700">
                {t('Delivery fee is paid by the business.', 'رسوم التوصيل يدفعها المتجر.')}
              </div>
            )}
            {isDelivery && data.order.shopperFee != null && (
              <div className="flex justify-between text-slate-600 text-sm">
                <span>{t('Personal shopper', 'المتسوق الشخصي')}</span>
                <span className="font-medium">
                  {shopperFee > 0
                    ? `${shopperFee.toFixed(2)} ${formatCurrency(data.order.currency)}`
                    : t('FREE', 'مجاناً')}
                </span>
              </div>
            )}
            {tipEnabled && tipAmount > 0 && (
              <div className="flex justify-between text-slate-600 text-sm">
                <span>{t('Tip', 'إكرامية')}</span>
                <span className="font-medium">{tipAmount.toFixed(2)} {formatCurrency(data.order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200/60 text-lg">
              <span>{t('Total', 'المجموع')}</span>
              <span>
                {displayTotal.toFixed(2)} {formatCurrency(data.order.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Order — delivery only, for stores (not restaurants/cafes), before picked up / completed / cancelled. */}
      {isDelivery &&
        data.order &&
        !['restaurant', 'cafe'].includes(data.order.businessType ?? '') &&
        !['completed', 'cancelled', 'refunded', 'out-for-delivery'].includes(data.order.status ?? '') &&
        !data.order.driverPickedUpAt && (
        <div className="mt-4 px-4">
          <button
            type="button"
            onClick={openEditOrder}
            className="w-full min-h-[52px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base flex items-center justify-center gap-2 shadow-md shadow-indigo-200/50"
          >
            <Pencil className="w-5 h-5 shrink-0" />
            {t('Edit order', 'تعديل الطلب')}
          </button>
        </div>
      )}

      {/* Edit Order modal */}
      <AnimatePresence>
        {showEditOrder && data?.order && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-end sm:justify-center p-0 sm:p-4"
            onClick={() => setShowEditOrder(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
                <h2 className="text-lg font-bold text-slate-900">
                  {t('Edit order', 'تعديل الطلب')}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowEditOrder(false)}
                  className="w-10 h-10 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700"
                  aria-label={t('Close', 'إغلاق')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Cart items — M3 style */}
                <div className="space-y-2">
                  {editItems.map((item, idx) => (
                    <div
                      key={item._key ?? idx}
                      className="rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden flex gap-3 p-3"
                    >
                      {item.imageUrl ? (
                        <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-slate-200">
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="shrink-0 w-14 h-14 rounded-xl bg-slate-200 flex items-center justify-center">
                          <Package className="w-6 h-6 text-slate-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate">{item.productName}</p>
                        <p className="text-sm text-indigo-600 font-bold">
                          {(item.price ?? 0).toFixed(2)} {formatCurrency(data.order.currency)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => updateEditItemQty(idx, -1)}
                            className="w-9 h-9 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700 disabled:opacity-50"
                            disabled={(item.quantity ?? 1) <= 1}
                            aria-label={t('Decrease', 'تقليل')}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="min-w-[2rem] text-center font-bold text-slate-800">{item.quantity ?? 1}</span>
                          <button
                            type="button"
                            onClick={() => updateEditItemQty(idx, 1)}
                            className="w-9 h-9 rounded-full bg-indigo-100 hover:bg-indigo-200 flex items-center justify-center text-indigo-700"
                            aria-label={t('Increase', 'زيادة')}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEditItem(idx)}
                        className="shrink-0 w-10 h-10 rounded-full bg-rose-100 hover:bg-rose-200 flex items-center justify-center text-rose-600 self-center"
                        aria-label={t('Remove', 'حذف')}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add product — same behavior as driver: button toggles to form */}
                {!addProductFormOpen ? (
                  <button
                    type="button"
                    onClick={() => setAddProductFormOpen(true)}
                    className="w-full min-h-[52px] rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 font-bold text-base flex items-center justify-center gap-2"
                  >
                    <Package className="w-5 h-5 shrink-0" />
                    {t('Add a product', 'إضافة صنف')}
                  </button>
                ) : (
                  <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/30 p-4 space-y-3 relative">
                    <button
                      type="button"
                      onClick={() => setAddProductFormOpen(false)}
                      className="absolute top-3 end-3 w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600"
                      aria-label={t('Close', 'إغلاق')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <p className="text-sm font-bold text-slate-800 pe-10">{t('Search or browse menu', 'ابحث أو تصفح القائمة')}</p>
                    <div className="flex gap-2">
                      <input
                        value={orderSearchQuery}
                        onChange={(e) => setOrderSearchQuery(e.target.value)}
                        placeholder={t('Search', 'بحث')}
                        className="flex-1 min-h-[48px] rounded-xl border-2 border-slate-200 bg-white px-4 text-slate-900 placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBrowseMenu(true)}
                        className="min-h-[48px] px-4 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold flex items-center gap-2"
                        title={t('Browse full menu', 'عرض القائمة كاملة')}
                      >
                        <LayoutGrid className="w-4 h-4" />
                        {t('Menu', 'القائمة')}
                      </button>
                      <button
                        type="button"
                        onClick={() => loadOrderProducts(orderSearchQuery)}
                        disabled={orderSearchLoading}
                        className="min-h-[48px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-50 flex items-center gap-2"
                      >
                        <Search className="w-4 h-4" />
                        {orderSearchLoading ? t('Searching...', 'جاري...') : t('Search', 'بحث')}
                      </button>
                    </div>
                    {orderSearchProducts.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {orderSearchProducts.map((p) => {
                          const selected = orderSelectedProductId === p._id
                          const name = lang === 'ar' ? p.title_ar : p.title_en
                          return (
                            <button
                              key={p._id}
                              type="button"
                              onClick={() => setOrderSelectedProductId(selected ? null : p._id)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${selected ? 'border-indigo-500 bg-indigo-100' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                            >
                              {p.imageUrl ? (
                                <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-slate-100">
                                  <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="shrink-0 w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                                  <Package className="w-5 h-5 text-slate-400" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-900 truncate">{name}</p>
                                <p className="text-sm font-bold text-indigo-600">{p.price.toFixed(2)} {formatCurrency(p.currency)}</p>
                              </div>
                              {selected && <span className="text-indigo-600 font-bold">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        {orderSearchLoading ? t('Searching...', 'جاري البحث...') : t('Search above to add.', 'ابحث أعلاه للإضافة.')}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => orderSelectedProductId && orderSearchProducts.find((p) => p._id === orderSelectedProductId) && addProductToEdit(orderSearchProducts.find((p) => p._id === orderSelectedProductId)!)}
                      disabled={!orderSelectedProductId}
                      className="w-full min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-50"
                    >
                      ➕ {t('Add selected item', 'إضافة الصنف المحدد')}
                    </button>
                  </div>
                )}
              </div>
              <BrowseMenuModal
                open={showBrowseMenu}
                onClose={() => setShowBrowseMenu(false)}
                fetchUrl={slug && effectiveTrackingToken ? `/api/tenants/${slug}/track/${encodeURIComponent(effectiveTrackingToken)}/order-menu` : ''}
                onSelect={(row) => addProductToEdit(row)}
                currency={data?.order?.currency}
                variant="customer"
              />
              <div className="px-4 py-4 border-t border-slate-200 bg-slate-50/80 shrink-0 space-y-3">
                <Button
                  onClick={submitEditOrder}
                  disabled={editItems.length === 0 || editOrderSaving}
                  className="w-full min-h-[56px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base"
                >
                  {editOrderSaving
                    ? t('Sending...', 'جارٍ الإرسال...')
                    : data.driver?.name
                      ? t('Update cart & inform', 'تحديث السلة وإشعار') + ` ${data.driver.name}`
                      : t('Update cart & inform driver', 'تحديث السلة وإشعار السائق')}
                </Button>
                <p className="text-xs text-slate-500 text-center">
                  {t('The driver must approve your changes.', 'يجب أن يوافق السائق على التغييرات.')}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tips option — under Order Details: only for Dine-in and In Person. Delivery uses the tip box in the ETA section when driver is on the way. */}
      {(isDineIn || isPickup) && !isDeliveryActive && (
        <div className="mt-5 px-4">
          <div className="rounded-3xl border border-rose-200/60 bg-gradient-to-b from-rose-50 to-rose-100/30 shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="h-5 w-5 text-rose-400" />
                <p className="font-bold text-rose-800 text-[15px]">
                  {isDineIn
                    ? t('Thank the staff?', 'هل تود شكر الطاقم؟')
                    : t('Show your appreciation?', 'هل تود إظهار تقديرك؟')}
                </p>
              </div>
              <p className="text-xs text-rose-500/70 mb-4 leading-relaxed">
                {isDineIn
                  ? t('Great service deserves a little extra!', 'الخدمة المميزة تستحق التقدير!')
                  : t('A kind gesture goes a long way!', 'لفتة لطيفة تصنع فرقاً!')}
              </p>

              <div className="flex gap-3">
                <motion.button
                  type="button"
                  onClick={() => handleTipToggle(true)}
                  whileTap={{ scale: 0.95 }}
                  className={`flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 ${
                    tipEnabled
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-300/40'
                      : 'bg-white text-rose-600 border-2 border-rose-200 hover:border-rose-300 hover:bg-rose-50'
                  }`}
                >
                  {tipEnabled ? '💚 ' : ''}{t('Yes, add a tip!', 'نعم، أضف إكرامية!')}
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => handleTipToggle(false)}
                  whileTap={{ scale: 0.95 }}
                  className={`flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 ${
                    !tipEnabled
                      ? 'bg-slate-600 text-white shadow-lg shadow-slate-300/40'
                      : 'bg-white text-slate-400 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {t('No, thanks', 'لا، شكراً')}
                </motion.button>
              </div>

              <AnimatePresence>
                {tipEnabled && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4">
                      <p className="text-xs text-rose-600/80 font-semibold mb-2.5">
                        {t('Choose tip amount', 'اختر مبلغ الإكرامية')}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {getSuggestedTips(totalAmount).map((amt) => (
                          <motion.button
                            key={amt}
                            type="button"
                            onClick={() => handleTipAmountChange(amt)}
                            whileTap={{ scale: 0.9 }}
                            animate={selectedTipAmount === amt ? { scale: [1, 1.08, 1] } : {}}
                            transition={{ duration: 0.25 }}
                            className={`flex-1 min-w-[3.5rem] py-2.5 rounded-2xl text-sm font-bold transition-all duration-200 ${
                              selectedTipAmount === amt
                                ? 'bg-rose-500 text-white shadow-md shadow-rose-300/50 ring-2 ring-rose-300/60'
                                : 'bg-white text-rose-500 border border-rose-200 hover:border-rose-300 hover:bg-rose-50'
                            }`}
                          >
                            +{amt} {formatCurrency(currency)}
                          </motion.button>
                        ))}
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={`${selectedTipAmount}`}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="text-center text-xs text-rose-400 mt-3"
                        >
                          {t('New total:', 'المجموع الجديد:')} {(totalAmount + selectedTipAmount).toFixed(2)} {formatCurrency(currency)}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {!tipEnabled && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center text-xs text-slate-400 mt-3"
                  >
                    {t('No worries! You can change your mind anytime.', 'لا مشكلة! يمكنك تغيير رأيك في أي وقت.')}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Animated total with tip */}
            <AnimatePresence>
              {tipEnabled && tipAmount > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden border-t border-rose-200/40"
                >
                  <div className="px-5 py-3 bg-white/60 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">
                      {t('Total with tip', 'المجموع مع الإكرامية')}
                    </span>
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={displayTotal.toFixed(2)}
                        initial={{ y: -8, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 8, opacity: 0, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                        className="text-lg font-black text-slate-900 tabular-nums"
                      >
                        {displayTotal.toFixed(2)} {formatCurrency(currency)}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      

            {/* Dine-in: Call waiter alert (Buttons moved to sticky bottom bar) */}
      {isDineIn && !['completed', 'cancelled', 'refunded'].includes(data.order.status ?? '') && data.order.customerRequestedAt && !data.order.customerRequestAcknowledgedAt && (
        <div className="mt-5 px-4">
          <p className="text-sm font-medium text-amber-700 bg-amber-50 rounded-xl px-4 py-3 flex items-center gap-2 border border-amber-200">
            <Clock className="h-4 w-4 animate-pulse" />
            {t('Request sent — waiting for staff to respond.', 'تم إرسال الطلب — في انتظار رد الطاقم.')}
          </p>
        </div>
      )}

      {/* Modal: Ask for check — Cash or Card */}
      {showCheckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCheckModal(false)}>
        <div className="rounded-3xl border border-slate-200/60 bg-white shadow-md max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
          <h3 className="font-bold text-slate-800 text-lg mb-1">{t('How would you like to pay?', 'كيف تفضل الدفع؟')}</h3>
          <p className="text-sm text-slate-500 mb-5">{t('Select your preferred payment method.', 'اختر طريقة الدفع المفضلة.')}</p>
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={() => sendRequest('request_check', 'cash')}
              disabled={requestSending}
              className="flex-1 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 h-12 shadow-sm"
            >
              <Banknote className="mr-2 h-5 w-5 rtl:ml-2 rtl:mr-0" />
              {t('Cash', 'نقداً')}
            </Button>
            <Button
              type="button"
              onClick={() => sendRequest('request_check', 'card')}
              disabled={requestSending}
              className="flex-1 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white h-12 shadow-sm"
            >
              <Coins className="mr-2 h-5 w-5 rtl:ml-2 rtl:mr-0" />
              {t('Card', 'بطاقة')}
            </Button>
          </div>
          <Button type="button" variant="ghost" className="mt-4 w-full rounded-2xl h-12" onClick={() => setShowCheckModal(false)}>
            {t('Cancel', 'إلغاء')}
          </Button>
        </div>
        </div>
      )}

      {/* Business contact */}
      {data.restaurant && (data.restaurant.whatsapp || data.restaurant.name_en || data.restaurant.name_ar) && (
        <div className="mt-5 px-4">
          <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden transition-all duration-300">
            <button
              type="button"
              onClick={() => setRestaurantOpen(!restaurantOpen)}
              className="w-full flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4 focus:outline-none"
            >
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Store className="h-5 w-5 text-slate-400" />
                {restaurantName}
              </h2>
              <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${restaurantOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${restaurantOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                <div className="p-5 flex flex-wrap gap-3 items-center">
                  {data.restaurant.whatsapp && (
                    <>
                      <Button asChild size="sm" className="bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl h-10 shadow-sm">
                        <a href={getWhatsAppUrl(data.restaurant.whatsapp, '', countryCode) || '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-1">
                          <MessageCircle className="h-4 w-4" />
                          {t('WhatsApp', 'واتساب')}
                        </a>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="rounded-xl border-slate-200 h-10 text-slate-700 hover:bg-slate-50">
                        <a href={`tel:+${normalizePhoneForWhatsApp(data.restaurant.whatsapp, countryCode)}`} className="inline-flex items-center gap-2 px-1">
                          <Phone className="h-4 w-4" />
                          {t('Call', 'اتصال')}
                        </a>
                      </Button>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-slate-500 hover:bg-slate-100 h-10 ml-auto rtl:mr-auto rtl:ml-0"
                    onClick={() => setReportTarget('business')}
                  >
                    <Flag className="h-4 w-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                    {t('Report', 'إبلاغ')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Driver contact (delivery only) */}
      {isDelivery && data.driver && (
        <div className="mt-5 px-4">
          <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden transition-all duration-300">
            <button
              type="button"
              onClick={() => setDriverOpen(!driverOpen)}
              className="w-full flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4 focus:outline-none"
            >
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Truck className="h-5 w-5 text-slate-400" />
                {t('Your driver', 'السائق')}
              </h2>
              <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${driverOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${driverOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                <div className="p-5">
                  <p className="font-medium text-slate-800 mb-3">{data.driver.name}</p>
                  <div className="flex flex-wrap gap-3 items-center">
                    {!['completed', 'cancelled', 'refunded'].includes(data.order.status ?? '') && (
                      <>
                        <Button asChild size="sm" className="bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl h-10 shadow-sm">
                          <a href={getWhatsAppUrl(data.driver.phoneNumber, '', countryCode) || '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-1">
                            <MessageCircle className="h-4 w-4" />
                            {t('WhatsApp', 'واتساب')}
                          </a>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="rounded-xl border-slate-200 h-10 text-slate-700 hover:bg-slate-50">
                          <a href={`tel:+${normalizePhoneForWhatsApp(data.driver.phoneNumber, countryCode)}`} className="inline-flex items-center gap-2 px-1">
                            <Phone className="h-4 w-4" />
                            {t('Call', 'اتصال')}
                          </a>
                        </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-slate-500 hover:bg-slate-100 h-10 ml-auto rtl:mr-auto rtl:ml-0"
                      onClick={() => setReportTarget('driver')}
                    >
                      <Flag className="h-4 w-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                      {t('Report', 'إبلاغ')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {data.order.orderType === 'delivery' && (data.order.deliveryAddress || (data.order.deliveryLat != null && data.order.deliveryLng != null)) && (
        <div className="mt-5 px-4">
          <div className="rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
              <MapPin className="h-5 w-5 text-slate-400" />
              {t('Delivery address', 'عنوان التوصيل')}
            </h2>
            {data.order.deliveryAddress && (
              <p className="text-slate-600 text-sm leading-relaxed mb-3">{data.order.deliveryAddress}</p>
            )}
            {data.order.deliveryLat != null && data.order.deliveryLng != null && (
              <div className="flex flex-wrap gap-2">
                <a
                  href={getMapLink('google', { lat: data.order.deliveryLat, lng: data.order.deliveryLng })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 text-xs transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Google Maps
                </a>
                <a
                  href={getMapLink('apple', { lat: data.order.deliveryLat, lng: data.order.deliveryLng })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 text-xs transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Apple Maps
                </a>
                <a
                  href={getMapLink('waze', { lat: data.order.deliveryLat, lng: data.order.deliveryLng })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 text-xs transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Waze
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      
      </div>

            {/* Split Bill — shown inline for dine-in, auto-expanded for group orders */}
      {isDineIn && (
        <div className="mt-6 px-4">
          <button
            onClick={() => setSplitExpanded(v => !v)}
            className="w-full flex items-center justify-between rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4 text-left shadow-sm hover:bg-amber-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold text-amber-900 text-sm">{t('Split the bill', 'تقسيم الفاتورة')}</p>
                {!splitExpanded && (
                  <p className="text-xs text-amber-700">
                    {splitPeople > 1
                      ? `${splitPeople} ${t('people', 'أشخاص')} · ${perPerson.toFixed(2)} ${formatCurrency(currency)} ${t('each', 'لكل شخص')}`
                      : t('Tap to split among guests', 'اضغط للتقسيم على الضيوف')}
                  </p>
                )}
              </div>
            </div>
            <span className="text-amber-600 text-sm font-medium">{splitExpanded ? '▲' : '▼'}</span>
          </button>

          {splitExpanded && (
            <div className="mt-2 rounded-2xl border-2 border-amber-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                {t('Dividing among friends? Choose how many people.', 'تقسمون بين الأصدقاء؟ اختروا عدد الأشخاص.')}
                {groupParticipantsCount && groupParticipantsCount > 1 && (
                  <span className="ml-1 text-amber-600 font-medium">
                    {t(`(${groupParticipantsCount} people joined the group order)`, `(${groupParticipantsCount} أشخاص انضموا للطلب الجماعي)`)}
                  </span>
                )}
              </p>
              <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-4">
                <span className="font-medium text-slate-700">{t('People', 'الأشخاص')}</span>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSplitPeople(n => Math.max(1, n - 1))}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm active:scale-95 transition"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-xl font-bold text-slate-900 w-6 text-center">{splitPeople}</span>
                  <button
                    onClick={() => setSplitPeople(n => n + 1)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 flex items-center justify-between">
                <span className="text-sm font-bold text-amber-900">{t('Each pays', 'كل شخص يدفع')}</span>
                <span className="text-2xl font-black text-amber-600">
                  {perPerson.toFixed(2)} <span className="text-sm">{formatCurrency(currency)}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

            {/* Utility Actions */}
      <div className="mt-4 px-4 flex flex-col gap-3">
        {!isDineIn && (
          <Button
            variant="outline"
            onClick={() => setShowSplitModal(true)}
            className="rounded-[2rem] border-slate-300 text-slate-800 h-14 font-medium hover:bg-slate-50 shadow-sm justify-start px-6"
          >
            <Users className="w-5 h-5 mr-3 rtl:ml-3 rtl:mr-0 text-slate-500" />
            {t('Split the bill', 'تقسيم الفاتورة')}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={copyTrackLink}
          className="rounded-[2rem] border-slate-300 text-slate-800 h-14 font-medium hover:bg-slate-50 shadow-sm justify-start px-6"
        >
          <Copy className="w-5 h-5 mr-3 rtl:ml-3 rtl:mr-0 text-slate-500" />
          {copied ? t('Copied!', 'تم النسخ!') : t('Copy tracking link', 'نسخ رابط التتبع')}
        </Button>
        {trackUrl && (
          <Button asChild variant="outline" className="rounded-[2rem] border-slate-300 text-slate-800 h-14 font-medium hover:bg-slate-50 shadow-sm justify-start px-6">
            <a href={trackUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-5 h-5 mr-3 rtl:ml-3 rtl:mr-0 text-slate-500" />
              {t('Open in new tab', 'فتح في نافذة جديدة')}
            </a>
          </Button>
        )}
      </div>

      <div className="mt-8 px-4 border-t border-slate-200/60 pt-8 space-y-4">
        <div className="px-2">
          <h3 className="font-bold text-slate-800 text-sm mb-1">{t('Device Settings', 'إعدادات الجهاز')}</h3>
          <p className="text-xs text-slate-500 mb-4">
            {isDelivery
              ? t('Enable notifications to stay updated, and share your location to help the driver find you faster.', 'فعّل الإشعارات لتصلك التحديثات، وشارك موقعك لمساعدة السائق في الوصول إليك أسرع.')
              : t('Enable notifications to stay updated on your order status.', 'فعّل الإشعارات لتصلك تحديثات حالة طلبك.')}
          </p>
        </div>
        <CustomerTrackPushStatusCard slug={slug} token={effectiveTrackingToken || token || ''} />
        {isDelivery && !['completed', 'cancelled', 'refunded'].includes(data.order.status ?? '') && (
          <CustomerLocationShare orderId={data.order._id} trackingToken={effectiveTrackingToken || ''} />
        )}
      </div>

      {reportTarget && data?.order?._id && (
        <ReportFormModal
          open={true}
          onClose={() => setReportTarget(null)}
          reporterType="customer"
          reportedType={reportTarget}
          orderId={data.order._id}
          slug={slug}
          trackingToken={effectiveTrackingToken || token}
          onSuccess={() => setReportTarget(null)}
        />
      )}

      {/* Sticky Bottom Bar for Critical Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-t border-slate-200/60 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-lg flex gap-3">
          {isDelivery && isOutForDelivery && data.driver ? (
            <>
              <Button asChild className="flex-1 rounded-[1.25rem] h-14 bg-slate-900 text-white hover:bg-slate-800 font-bold shadow-sm active:scale-95 transition-all">
                <a href={`tel:+${normalizePhoneForWhatsApp(data.driver.phoneNumber, countryCode)}`}>
                  <Phone className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0" />
                  {t('Call Driver', 'الاتصال بالسائق')}
                </a>
              </Button>
              {getWhatsAppUrl(data.driver.phoneNumber, '', countryCode) && (
                <Button asChild className="flex-1 rounded-[1.25rem] h-14 bg-[#25D366] text-white hover:bg-[#20bd5a] font-bold shadow-sm active:scale-95 transition-all">
                  <a href={getWhatsAppUrl(data.driver.phoneNumber, '', countryCode)!} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0" />
                    WhatsApp
                  </a>
                </Button>
              )}
            </>
          ) : isDineIn && !['completed', 'cancelled', 'refunded'].includes(data.order.status ?? '') ? (
            <>
              <Button onClick={() => sendRequest('call_waiter')} disabled={requestSending} className="flex-1 rounded-[1.25rem] h-14 bg-slate-900 text-white hover:bg-slate-800 font-bold shadow-sm active:scale-95 transition-all">
                <HandHelping className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('Call Waiter', 'استدعاء النادل')}
              </Button>
              <Button onClick={() => setShowCheckModal(true)} disabled={requestSending} variant="outline" className="flex-1 rounded-[1.25rem] h-14 border-slate-300 text-slate-800 hover:bg-slate-50 font-bold shadow-sm active:scale-95 transition-all">
                <CreditCard className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('Check', 'الفاتورة')}
              </Button>
            </>
          ) : (
            <Button asChild className="flex-1 rounded-[1.25rem] h-14 bg-slate-100 text-slate-800 hover:bg-slate-200 font-bold shadow-sm active:scale-95 transition-all">
              <Link href={`/t/${slug}`}>
                {t('Back to menu', 'العودة إلى القائمة')}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Modal: Split the Bill */}
      <AnimatePresence>
        {showSplitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center p-4"
            onClick={() => setShowSplitModal(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl relative"
            >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden" />
              
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Users className="h-6 w-6 text-amber-500" />
                  {t('Split the bill', 'تقسيم الفاتورة')}
                </h3>
                <button
                  onClick={() => setShowSplitModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                {t('Dividing among friends? Choose how many people.', 'تقسمون بين الأصدقاء؟ اختروا عدد الأشخاص.')}
              </p>

              <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-6">
                <span className="font-medium text-slate-700">{t('People', 'الأشخاص')}</span>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSplitPeople(n => Math.max(1, n - 1))}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm active:scale-95 transition"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-xl font-bold text-slate-900 w-6 text-center">{splitPeople}</span>
                  <button
                    onClick={() => setSplitPeople(n => n + 1)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 flex items-center justify-between">
                <span className="text-sm font-bold text-amber-900">{t('Each pays', 'كل شخص يدفع')}</span>
                <span className="text-2xl font-black text-amber-600">
                  {perPerson.toFixed(2)} <span className="text-sm">{formatCurrency(currency)}</span>
                </span>
              </div>
              
              <Button
                onClick={() => setShowSplitModal(false)}
                className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl h-14 shadow-sm font-bold text-base"
              >
                {t('Done', 'تم')}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </CustomerTrackPushGate>
  )
}
