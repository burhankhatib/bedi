'use client'

import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Truck, History, Store, User, MapPin, Navigation, Flag, Wallet, Receipt, Smartphone, CircleAlert, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useLanguage } from '@/components/LanguageContext'
import { useDriverPush } from '../DriverPushContext'
import { useDriverStatus } from '../DriverStatusContext'
import { usePusherStream } from '@/lib/usePusherStream'
import { getWhatsAppUrl } from '@/lib/whatsapp'
import { parseCoordsFromGoogleMapsUrl, googleMapsNavigationUrl, wazeNavigationUrl } from '@/lib/maps-utils'
import { getCityDisplayName } from '@/lib/registration-translations'
import { DriverPWAInstall } from './DriverPWAInstall'
import { SlideToComplete } from './SlideToComplete'
import { SlideToPickUp } from './SlideToPickUp'
import { SlideToConfirm } from './SlideToConfirm'
import { ReportFormModal } from '@/components/Reports/ReportFormModal'

const OFFLINE_PUSH_SENT_KEY = 'driverOfflinePushSent'

type DriverOrder = {
  orderId: string
  orderNumber: string
  customerName: string
  customerPhone: string
  businessName: string
  businessAddress: string
  businessAddressAr?: string
  businessMapsLink?: string
  businessLocationLat?: number
  businessLocationLng?: number
  city: string
  deliveryAreaName: string
  deliveryAreaNameAr?: string
  deliveryAddress: string
  deliveryLat?: number
  deliveryLng?: number
  deliveryFee: number
  totalAmount: number
  amountToPayTenant: number
  currency: string
  status: string
  completedAt?: string
  itemsUpdatedAt?: string
  driverReconfirmedAt?: string
}

const NEW_ORDER_SOUND = '/sounds/1.wav'
const MAX_ACTIVE_DELIVERIES = 2

/** Show short order number for driver: ORD-...1060 (last 4 digits). */
function formatDriverOrderNumber(orderNumber: string): string {
  if (!orderNumber || orderNumber.length <= 4) return orderNumber
  const last4 = orderNumber.slice(-4)
  const prefix = orderNumber.startsWith('ORD-') ? 'ORD-...' : '...'
  return prefix + last4
}

/** Fire-and-forget location update for specific driver events */
const pushDriverLocation = () => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      fetch('/api/driver/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      }).catch(() => {})
    },
    () => {},
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  )
}

function DriverOrdersContent() {
  const { t, lang } = useLanguage()
  const { showToast } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { hasPush } = useDriverPush()
  const { isOnline, isVerifiedByAdmin, fetchStatus } = useDriverStatus()

  useEffect(() => {
    if (searchParams.get('goOnline') === '1') {
      if (!isOnline && isVerifiedByAdmin) {
        fetch('/api/driver/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isOnline: true }),
        }).then(() => fetchStatus())
      }
      router.replace('/driver/orders')
    }
  }, [searchParams, isOnline, isVerifiedByAdmin, router, fetchStatus])
  const [pending, setPending] = useState<DriverOrder[]>([])
  const [myDeliveries, setMyDeliveries] = useState<DriverOrder[]>([])
  const [myCompletedToday, setMyCompletedToday] = useState<DriverOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [reportOrderId, setReportOrderId] = useState<string | null>(null)
  const prevPendingCountRef = useRef(0)
  const declinedOrderIdsRef = useRef<Set<string>>(new Set())
  const acceptedAtRef = useRef<Map<string, number>>(new Map())

  // Pull-to-refresh states
  const [startY, setStartY] = useState<number | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const MAX_PULL_DISTANCE = 120
  const REFRESH_THRESHOLD = 80

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/driver/orders', { cache: 'no-store' })
      if (res.status === 403) {
        window.location.href = '/suspended?type=driver'
        return
      }
      const data = await res.json()
      if (res.ok && data) {
        let nextPending = (Array.isArray(data.pending) ? data.pending : []).filter(
          (o: DriverOrder) => !declinedOrderIdsRef.current.has(o.orderId)
        )
        const nextMy = Array.isArray(data.myDeliveries) ? data.myDeliveries : []
        const nextCompleted = Array.isArray(data.myCompletedToday) ? data.myCompletedToday : []
        const now = Date.now()
        const acceptedKeepWindow = 5000
        const justAccepted = nextMy.filter((o: DriverOrder) => {
          const t = acceptedAtRef.current.get(o.orderId)
          return t != null && now - t < acceptedKeepWindow
        })
        const serverIds = new Set(nextMy.map((o: DriverOrder) => o.orderId))
        const mergedMy = [...nextMy]
        for (const o of justAccepted) {
          if (!serverIds.has(o.orderId)) {
            mergedMy.push(o)
            serverIds.add(o.orderId)
          }
        }
        const prevCount = prevPendingCountRef.current
        prevPendingCountRef.current = nextPending.length
        setPending(nextPending)
        setMyDeliveries(mergedMy)
        setMyCompletedToday(nextCompleted)
        if (nextPending.length > prevCount && prevCount >= 0) {
          try {
            const audio = new Audio(NEW_ORDER_SOUND)
            audio.volume = 1
            audio.play().catch(() => {})
          } catch (_) {}
        }
      }
    } catch {
      // keep previous state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Always refetch when user opens the app or returns to this tab so new orders appear even if SSE missed or FCM was backgrounded.
  useEffect(() => {
    const onFocus = () => fetchOrders()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchOrders()
    }
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_NOTIFICATION_CLICK') fetchOrders()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onMessage)
    }
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onMessage)
      }
    }
  }, [fetchOrders])

  // Refetch orders immediately when the driver goes online
  useEffect(() => {
    if (isOnline) {
      fetchOrders()
    }
  }, [isOnline, fetchOrders])

  usePusherStream('driver-global', 'order-update', fetchOrders, { debounceMs: 700 })

  // Once per session: if driver has push and is offline, send a friendly reminder push (Arabic).
  useEffect(() => {
    if (typeof window === 'undefined' || !hasPush || isOnline) return
    if (sessionStorage.getItem(OFFLINE_PUSH_SENT_KEY)) return
    sessionStorage.setItem(OFFLINE_PUSH_SENT_KEY, '1')
    fetch('/api/driver/push-send-offline-reminder', { method: 'POST' }).catch(() => {})
  }, [hasPush, isOnline])

  const canAcceptMore = myDeliveries.length < MAX_ACTIVE_DELIVERIES

  const accept = async (orderId: string) => {
    if (!canAcceptMore) {
      showToast(
        t('You can have at most 2 active deliveries. Complete or cancel one to accept more.', 'يمكنك تنفيذ توصيلتين نشطتين فقط. أكمِل أو ألغِ واحدة لقبول المزيد.'),
        t('You can have at most 2 active deliveries. Complete or cancel one to accept more.', 'يمكنك تنفيذ توصيلتين نشطتين فقط. أكمِل أو ألغِ واحدة لقبول المزيد.'),
        'info'
      )
      return
    }
    const order = pending.find((x) => x.orderId === orderId)
    if (!order) return
    setActionId(orderId)
    setPending((prev) => prev.filter((x) => x.orderId !== orderId))
    setMyDeliveries((prev) => [{ ...order, status: 'driver_on_the_way' }, ...prev])
    acceptedAtRef.current.set(orderId, Date.now())
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/accept`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to accept')
      }
      showToast(t('Order accepted.', 'تم قبول الطلب.'), t('Order accepted.', 'تم قبول الطلب.'), 'success')
      pushDriverLocation()
      // Live stream will refetch when Sanity order doc updates; no extra fetch here
    } catch (e) {
      acceptedAtRef.current.delete(orderId)
      setPending((prev) => [order, ...prev])
      setMyDeliveries((prev) => prev.filter((x) => x.orderId !== orderId))
      showToast(t('Failed to accept order.', 'فشل قبول الطلب.'), t('Failed to accept order.', 'فشل قبول الطلب.'), 'error')
    } finally {
      setActionId(null)
    }
  }

  const decline = async (orderId: string) => {
    const order = pending.find((x) => x.orderId === orderId)
    setActionId(orderId)
    declinedOrderIdsRef.current.add(orderId)
    setPending((prev) => prev.filter((x) => x.orderId !== orderId))
    try {
      await fetch(`/api/driver/orders/${orderId}/decline`, { method: 'POST' })
      // Live stream will refetch when Sanity order doc updates
    } catch {
      declinedOrderIdsRef.current.delete(orderId)
      if (order) setPending((prev) => [order, ...prev])
    } finally {
      setActionId(null)
    }
  }

  const cancel = async (orderId: string) => {
    setActionId(orderId)
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/cancel`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to cancel')
      }
      showToast(t('Delivery cancelled. Order is available for other drivers.', 'تم إلغاء التوصيل. الطلب متاح لسائقيْن آخرين.'), t('Delivery cancelled. Order is available for other drivers.', 'تم إلغاء التوصيل. الطلب متاح لسائقيْن آخرين.'), 'success')
      // Live stream will refetch when order doc updates (unassigned)
    } catch (e) {
      showToast(t('Failed to cancel delivery.', 'فشل إلغاء التوصيل.'), t('Failed to cancel delivery.', 'فشل إلغاء التوصيل.'), 'error')
    } finally {
      setActionId(null)
    }
  }

  const reconfirm = async (orderId: string) => {
    setActionId(orderId)
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/reconfirm`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      showToast(t('Order confirmed. New amount acknowledged.', 'تم التأكيد. تم الإقرار بالمبلغ الجديد.'), t('Order confirmed. New amount acknowledged.', 'تم التأكيد. تم الإقرار بالمبلغ الجديد.'), 'success')
      // Live stream will refetch when order doc updates
    } catch {
      showToast(t('Failed to confirm.', 'فشل التأكيد.'), t('Failed to confirm.', 'فشل التأكيد.'), 'error')
    } finally {
      setActionId(null)
    }
  }

  const pickUp = async (orderId: string) => {
    const order = myDeliveries.find((x) => x.orderId === orderId)
    if (!order) return
    setActionId(orderId)
    setMyDeliveries((prev) => prev.map((x) => x.orderId === orderId ? { ...x, status: 'out-for-delivery' } : x))
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/pick-up`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to pick up')
      }
      showToast(t('Order picked up.', 'تم استلام الطلب من المتجر.'), t('Order picked up.', 'تم استلام الطلب من المتجر.'), 'success')
      pushDriverLocation()
      // Live stream will refetch when Sanity order doc updates
    } catch (e) {
      setMyDeliveries((prev) => prev.map((x) => x.orderId === orderId ? order : x))
      showToast(t('Failed to mark as picked up.', 'فشل تسجيل الاستلام.'), t('Failed to mark as picked up.', 'فشل تسجيل الاستلام.'), 'error')
    } finally {
      setActionId(null)
    }
  }

  const complete = async (orderId: string) => {
    const order = myDeliveries.find((x) => x.orderId === orderId)
    if (!order) return
    setActionId(orderId)
    const completedOrder: DriverOrder = { ...order, status: 'completed', completedAt: new Date().toISOString() }
    setMyDeliveries((prev) => prev.filter((x) => x.orderId !== orderId))
    setMyCompletedToday((prev) => [completedOrder, ...prev])
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/complete`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to complete')
      }
      showToast(t('Delivery marked complete.', 'تم تسجيل الطلب مكتملًا.'), t('Delivery marked complete.', 'تم تسجيل الطلب مكتملًا.'), 'success')
      pushDriverLocation()
      // Live stream will refetch when Sanity order doc updates
    } catch (e) {
      setMyDeliveries((prev) => [order, ...prev])
      setMyCompletedToday((prev) => prev.filter((x) => x.orderId !== orderId))
      showToast(t('Failed to mark complete.', 'فشل تسجيل الإكمال.'), t('Failed to mark complete.', 'فشل تسجيل الإكمال.'), 'error')
    } finally {
      setActionId(null)
    }
  }

  const formatCurrency = (c: string) => (c === 'USD' ? '$' : c === 'EUR' ? '€' : '₪')

  const needsReconfirm = (o: DriverOrder) =>
    !!o.itemsUpdatedAt && (!o.driverReconfirmedAt || o.driverReconfirmedAt < o.itemsUpdatedAt)

  const OrderCardContent = ({ o, isGreen, showComplete, showAcceptDecline, acceptDisabled }: {
    o: DriverOrder
    isGreen: boolean
    showComplete: boolean
    showAcceptDecline: boolean
    acceptDisabled?: boolean
  }) => {
    const showReconfirmBanner = showComplete && needsReconfirm(o)
    const isEnRouteToCustomer = o.status === 'out-for-delivery'
    const navPrimary = 'inline-flex w-full sm:w-auto flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-bold transition-all min-h-[56px] touch-manipulation shadow-sm'
    const navSecondary = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all'
    return (
    <>
      {showReconfirmBanner && (
        <div className="rounded-3xl border border-amber-500/40 bg-amber-950/30 p-4 mb-4">
          <p className="text-amber-200 font-semibold text-sm mb-2">
            {t('Order was updated by the business. New amount to pay:', 'تم تحديث الطلب من قبل المتجر. المبلغ الجديد المطلوب دفعه:')}
          </p>
          <p className="text-amber-100 font-bold text-lg mb-3">
            {o.amountToPayTenant.toFixed(2)} {o.currency} {t('to', 'إلى')} {o.businessName}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => reconfirm(o.orderId)}
              disabled={actionId === o.orderId}
              className="rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-3 text-sm disabled:opacity-70 shadow-sm"
            >
              {actionId === o.orderId ? t('Confirming…', 'جاري التأكيد…') : t('Confirm', 'تأكيد')}
            </button>
            <button
              type="button"
              onClick={() => cancel(o.orderId)}
              disabled={actionId === o.orderId}
              className="rounded-2xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-5 py-3 text-sm disabled:opacity-70"
            >
              {t('Decline', 'رفض')}
            </button>
          </div>
        </div>
      )}
      {showComplete && (o.customerName || o.customerPhone) && (
        <div className="rounded-3xl bg-slate-800/40 border border-slate-700/50 p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700/50 text-slate-300">
              <User className="h-5 w-5" />
            </div>
            <span className="font-bold text-slate-100 text-lg">{o.customerName || '—'}</span>
          </div>
          {o.customerPhone ? (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`tel:${o.customerPhone.replace(/\s/g, '')}`}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold px-4 py-3 min-h-[48px] transition-colors"
              >
                {o.customerPhone}
              </a>
              {getWhatsAppUrl(o.customerPhone) && (
                <a
                  href={getWhatsAppUrl(o.customerPhone)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-bold px-4 py-3 min-h-[48px] transition-colors"
                  title={t('Message on WhatsApp', 'مراسلة على واتساب')}
                >
                  WhatsApp
                </a>
              )}
            </div>
          ) : null}
        </div>
      )}
      {/* Payment summary: 1 big box with 3 sections (pay to business | delivery fee | total from client) */}
      <div className="rounded-3xl border border-slate-700/60 bg-slate-800/30 p-4 mb-4 space-y-4">
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-amber-200/80 text-sm font-medium">{t('You need to pay', 'المبلغ المطلوب دفعه')}</p>
            <p className="font-black text-amber-400 text-lg">
              {o.amountToPayTenant.toFixed(2)} {formatCurrency(o.currency)} <span className="text-amber-200/60 text-base font-medium mx-1">{t('to', 'إلى')}</span> {o.businessName}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-6 rounded-2xl bg-sky-500/10 border border-sky-500/20 p-3.5 flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="h-4 w-4 text-sky-400 shrink-0" />
              <span className="text-sky-200/80 text-xs font-semibold">{t('Delivery fee', 'سعر التوصيل')}</span>
            </div>
            <span className="font-black text-sky-400 text-lg">{o.deliveryFee.toFixed(2)} {formatCurrency(o.currency)}</span>
          </div>
          <div className="col-span-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-emerald-200/80 text-xs font-semibold truncate">
                {t('Total from', 'المجموع من')} {(o.customerName || '').trim().split(/\s+/)[0] || t('client', 'العميل')}
              </span>
            </div>
            <span className="font-black text-emerald-400 text-xl">{o.totalAmount.toFixed(2)} {formatCurrency(o.currency)}</span>
          </div>
        </div>
      </div>

      {/* Business (Pickup) Location */}
      <div className="rounded-3xl bg-slate-800/40 border border-slate-700/50 p-4 mb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
            <Store className="h-5 w-5" />
          </div>
          <span className="font-bold text-slate-200 text-lg">{t('Pickup from', 'استلام من')}</span>
        </div>
        <p className="text-slate-300 text-[15px] leading-relaxed pr-2 ml-12 rtl:mr-12 rtl:ml-2">
          {lang === 'ar' && (o.businessAddressAr || '').trim() ? o.businessAddressAr : (o.businessAddress || o.businessName || '—')}
        </p>
        {(o.businessMapsLink || o.businessLocationLat != null || o.businessAddress || o.businessAddressAr || o.businessName) && (() => {
          const addressEn = [o.businessAddress, o.businessName].filter(Boolean).join(', ') || t('Store', 'المتجر')
          const address = lang === 'ar' && (o.businessAddressAr || '').trim() ? [o.businessAddressAr, o.businessName].filter(Boolean).join(', ') || addressEn : addressEn
          let coords: { lat: number; lng: number } | null = null
          if (o.businessLocationLat != null && o.businessLocationLng != null) {
            coords = { lat: o.businessLocationLat, lng: o.businessLocationLng }
          } else {
            coords = parseCoordsFromGoogleMapsUrl(o.businessMapsLink)
          }
          const googleNavUrl = googleMapsNavigationUrl(coords ?? address)
          const wazeNavUrl = wazeNavigationUrl(coords ?? address)
          const isBusinessPrimary = !isEnRouteToCustomer && showComplete
          const base = isBusinessPrimary ? navPrimary : navSecondary
          const googleClass = isBusinessPrimary ? `${base} bg-[#FFC107] hover:bg-[#FFCA28] text-slate-900` : `${base} bg-slate-700/50 hover:bg-slate-600 text-amber-400`
          const wazeClass = isBusinessPrimary ? `${base} bg-[#0096FF] hover:bg-[#29B6F6] text-white` : `${base} bg-slate-700/50 hover:bg-slate-600 text-sky-400`
          return (
            <div className={`flex flex-wrap gap-3 mt-4 ${isBusinessPrimary ? 'flex-col sm:flex-row' : ''}`}>
              <a href={googleNavUrl} target="_blank" rel="noopener noreferrer" className={googleClass} title={t('Navigate to pickup (Google Maps)', 'التنقل إلى نقطة الاستلام (Google Maps)')}>
                <Navigation className="h-5 w-5 shrink-0" />
                Google Maps
              </a>
              <a href={wazeNavUrl} target="_blank" rel="noopener noreferrer" className={wazeClass} title={t('Navigate to pickup (Waze)', 'التنقل إلى نقطة الاستلام (Waze)')}>
                <Navigation className="h-5 w-5 shrink-0" />
                Waze
              </a>
            </div>
          )
        })()}
      </div>

      {/* Customer (Delivery) Location */}
      <div className="rounded-3xl bg-slate-800/40 border border-slate-700/50 p-4 mb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <MapPin className="h-5 w-5" />
          </div>
          <span className="font-bold text-slate-200 text-lg">{t('Delivery', 'التوصيل')}</span>
        </div>
        <div className="text-slate-300 text-[15px] leading-relaxed pr-2 ml-12 rtl:mr-12 rtl:ml-2 space-y-1">
          {o.city && <p>{getCityDisplayName(o.city, lang)}</p>}
          <p><span className="font-semibold">{t('Area:', 'المنطقة:')}</span> {o.deliveryAreaName || o.deliveryAreaNameAr ? ((lang === 'ar' && o.deliveryAreaNameAr) ? o.deliveryAreaNameAr : o.deliveryAreaName) : t('Distance-based', 'حسب المسافة')}</p>
          <p><span className="font-semibold">{t('Address:', 'العنوان:')}</span> {o.deliveryAddress || '—'}</p>
        </div>
        {!showAcceptDecline && o.deliveryLat != null && o.deliveryLng != null && Number.isFinite(o.deliveryLat) && Number.isFinite(o.deliveryLng) && (
          <div className={`flex flex-wrap gap-3 mt-4 ${isEnRouteToCustomer ? 'flex-col sm:flex-row' : ''}`}>
            <a
              href={googleMapsNavigationUrl({ lat: o.deliveryLat, lng: o.deliveryLng })}
              target="_blank"
              rel="noopener noreferrer"
              className={isEnRouteToCustomer ? `${navPrimary} bg-[#10B981] hover:bg-[#34D399] text-white` : `${navSecondary} bg-slate-700/50 hover:bg-slate-600 text-emerald-400`}
              title={t('Navigate to customer (Google Maps)', 'التنقل إلى العميل (Google Maps)')}
            >
              <Navigation className="h-5 w-5 shrink-0" />
              {t('Maps', 'خرائط')} → {t('Customer', 'العميل')}
            </a>
            <a
              href={wazeNavigationUrl({ lat: o.deliveryLat, lng: o.deliveryLng })}
              target="_blank"
              rel="noopener noreferrer"
              className={isEnRouteToCustomer ? `${navPrimary} bg-[#0096FF] hover:bg-[#29B6F6] text-white` : `${navSecondary} bg-slate-700/50 hover:bg-slate-600 text-sky-400`}
              title={t('Navigate to customer (Waze)', 'التنقل إلى العميل (Waze)')}
            >
              <Navigation className="h-5 w-5 shrink-0" />
              Waze → {t('Customer', 'العميل')}
            </a>
          </div>
        )}
      </div>
      {showAcceptDecline && (
        <div className="flex flex-col gap-3 mt-4">
          {acceptDisabled && (
            <p className="rounded-2xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-amber-200/90 text-sm font-medium">
              {t('You can have at most 2 active deliveries. Complete or cancel one to accept more.', 'يمكنك تنفيذ توصيلتين نشطتين فقط. أكمِل أو ألغِ واحدة لقبول المزيد.')}
            </p>
          )}
          <SlideToConfirm orderId={o.orderId} variant="accept" onConfirm={accept} disabled={!!actionId || !!acceptDisabled} />
          <SlideToConfirm orderId={o.orderId} variant="decline" onConfirm={decline} disabled={!!actionId} />
        </div>
      )}
      {showComplete && (
        <div className="mt-4">
          {!showReconfirmBanner && (
            <>
              {(o.status === 'driver_on_the_way' || o.status === 'waiting_for_delivery') ? (
                <SlideToPickUp
                  orderId={o.orderId}
                  onPickUp={pickUp}
                  disabled={!!actionId}
                />
              ) : (
                <SlideToComplete
                  orderId={o.orderId}
                  onComplete={complete}
                  disabled={!!actionId}
                />
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between px-2 gap-4">
                <button
                  type="button"
                  onClick={() => setReportOrderId(o.orderId)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <Flag className="h-4 w-4" />
                  {t('Report customer', 'الإبلاغ عن العميل')}
                </button>
                <button
                  type="button"
                  onClick={() => cancel(o.orderId)}
                  disabled={actionId === o.orderId}
                  className="text-xs font-semibold text-rose-500/80 hover:text-rose-400 transition-colors underline underline-offset-4"
                >
                  {actionId === o.orderId ? t('Cancelling…', 'جاري الإلغاء…') : t('Cancel delivery', 'إلغاء التوصيل')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
  }

  const justRegistered = searchParams.get('registered') === '1'
  const [dismissedRegistered, setDismissedRegistered] = useState(false)
  const showJustRegistered = justRegistered && !dismissedRegistered

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY !== null && window.scrollY === 0) {
      const currentY = e.touches[0].clientY
      const distance = currentY - startY
      if (distance > 0) {
        setPullDistance(Math.min(distance * 0.5, MAX_PULL_DISTANCE))
      }
    }
  }

  const handleTouchEnd = async () => {
    if (pullDistance > REFRESH_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true)
      setPullDistance(REFRESH_THRESHOLD) // Hold at threshold while refreshing
      await fetchOrders()
      setIsRefreshing(false)
    }
    setPullDistance(0)
    setStartY(null)
  }

  return (
    <div 
      className="space-y-6 sm:space-y-8 relative touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-50"
        style={{ height: 0 }}
        animate={{ 
          y: isRefreshing ? REFRESH_THRESHOLD / 2 : pullDistance / 2,
          opacity: (pullDistance > 10 || isRefreshing) ? 1 : 0
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <div className="bg-slate-800 border border-slate-700 rounded-full p-2 shadow-lg flex items-center justify-center -mt-6">
          <motion.div
            animate={{ rotate: isRefreshing ? 360 : pullDistance * 2 }}
            transition={isRefreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : { type: "spring", stiffness: 200, damping: 20 }}
          >
            <RefreshCw className="w-5 h-5 text-emerald-400" />
          </motion.div>
        </div>
      </motion.div>

      {showJustRegistered && (
        <div className="rounded-xl border-2 border-amber-600/50 bg-amber-950/30 p-5" role="region" aria-label={t('Next steps after registration', 'الخطوات التالية بعد التسجيل')}>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/30 border border-amber-500/50" aria-hidden>
              <Smartphone className="h-7 w-7 text-amber-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-amber-100 text-lg mb-1">
                {t('You’re all set! Do this next:', 'تم التسجيل! افعل التالي:')}
              </p>
              <p className="text-amber-200/95 text-sm mb-4">
                {t('Enable notifications below to get new orders. Then install the app from this page so you get the correct driver app.', 'فعّل الإشعارات أدناه لاستقبال الطلبات. ثم ثبّت التطبيق من هذه الصفحة لتحصل على تطبيق السائق الصحيح.')}
              </p>
              <div className="rounded-lg bg-amber-900/40 border border-amber-600/40 p-3 mb-3">
                <p className="font-semibold text-amber-200 text-sm mb-2 flex items-center gap-2">
                  <CircleAlert className="h-4 w-4 shrink-0" />
                  {t('Important: Install from this page', 'مهم: ثبّت من هذه الصفحة')}
                </p>
                <p className="text-xs text-amber-200/90 mb-3">
                  {t('If you install from another page you may get the wrong app. Stay here on "Delivery orders" and use the install steps below.', 'إذا ثبّت من صفحة أخرى قد تحصل على تطبيق خاطئ. ابقَ هنا في "طلبات التوصيل" واستخدم خطوات التثبيت أدناه.')}
                </p>
                <ul className="text-sm text-amber-200/90 space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600/50 text-amber-100 text-xs font-bold">1</span>
                    {t('Android: tap Install when it appears below, or menu (⋮) → Add to Home screen.', 'Android: اضغط تثبيت عند ظهوره أدناه، أو القائمة (⋮) ← إضافة إلى الشاشة الرئيسية.')}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600/50 text-amber-100 text-xs font-bold">2</span>
                    {t('iPhone: Share → Add to Home Screen, then open from home screen.', 'iPhone: مشاركة ← إضافة إلى الشاشة الرئيسية، ثم افتح من الشاشة الرئيسية.')}
                  </li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => setDismissedRegistered(true)}
                className="text-xs text-amber-400 hover:text-amber-300 underline"
              >
                {t('Dismiss', 'إخفاء')}
              </button>
            </div>
          </div>
        </div>
      )}

      <DriverPWAInstall />

      <h1 className="font-black text-xl text-white sm:text-2xl">{t('Delivery orders', 'طلبات التوصيل')}</h1>

      {loading && pending.length === 0 && myDeliveries.length === 0 && myCompletedToday.length === 0 ? (
        <p className="text-slate-400 text-base">{t('Loading…', 'جاري التحميل...')}</p>
      ) : (
        <>
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-black text-lg text-slate-200 sm:text-xl tracking-tight">
              <Package className="h-6 w-6 shrink-0 text-slate-400" />
              {t('Available orders', 'طلبات متاحة')}
            </h2>
            {pending.length === 0 ? (
              <p className="text-slate-500 text-base bg-slate-900/40 rounded-3xl p-6 text-center border border-slate-800/60 border-dashed">
                {t('No orders right now. Stay online to receive new orders.', 'لا توجد طلبات الآن. ابقَ متصلًا لاستقبال طلبات جديدة.')}
              </p>
            ) : (
              <ul className="space-y-4">
                <AnimatePresence initial={false}>
                  {pending.map((o) => (
                    <motion.li
                      key={o.orderId}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="rounded-3xl border border-slate-700/60 bg-slate-900/90 p-4 sm:p-5 shadow-sm"
                    >
                      <div className="mb-4">
                        <span className="font-mono text-xl font-black text-white tracking-widest bg-slate-800/80 px-4 py-1.5 rounded-xl">#{formatDriverOrderNumber(o.orderNumber)}</span>
                      </div>
                      <OrderCardContent o={o} isGreen={false} showComplete={false} showAcceptDecline={true} acceptDisabled={!canAcceptMore} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 font-black text-lg text-slate-200 sm:text-xl tracking-tight">
              <Truck className="h-6 w-6 shrink-0 text-emerald-400" />
              {t('My deliveries', 'توصيلاتي')}
            </h2>
            {myDeliveries.length === 0 ? (
              <p className="text-slate-500 text-base bg-slate-900/40 rounded-3xl p-6 text-center border border-slate-800/60 border-dashed">
                {t('No active deliveries.', 'لا توجد توصيلات نشطة.')}
              </p>
            ) : (
              <ul className="space-y-4">
                <AnimatePresence initial={false}>
                  {myDeliveries.map((o) => (
                    <motion.li
                      key={o.orderId}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="rounded-3xl border-2 border-emerald-700/80 bg-emerald-950/20 p-4 sm:p-5 shadow-sm"
                    >
                      <div className="mb-4">
                        <span className="font-mono text-xl font-black text-emerald-400 tracking-widest bg-emerald-900/40 px-4 py-1.5 rounded-xl">#{formatDriverOrderNumber(o.orderNumber)}</span>
                      </div>
                      <OrderCardContent o={o} isGreen={true} showComplete={true} showAcceptDecline={false} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 font-black text-lg text-slate-200 sm:text-xl tracking-tight">
              <History className="h-6 w-6 shrink-0 text-slate-500" />
              {t('Completed today', 'تم اليوم')}
            </h2>
            {myCompletedToday.length === 0 ? (
              <p className="text-slate-500 text-base bg-slate-900/40 rounded-3xl p-6 text-center border border-slate-800/60 border-dashed">
                {t('No completed orders today.', 'لا توجد طلبات مكتملة اليوم.')}
              </p>
            ) : (
              <ul className="space-y-4">
                <AnimatePresence initial={false}>
                  {myCompletedToday.map((o) => (
                    <motion.li
                      key={o.orderId}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-4 sm:p-5 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-lg font-bold text-slate-300">#{formatDriverOrderNumber(o.orderNumber)}</span>
                        <span className="text-sm font-semibold text-slate-400">{o.businessName}</span>
                      </div>
                      <p className="text-slate-300 text-[15px] font-medium mt-1">
                        {t('Total', 'المجموع')} <span className="text-white font-bold">{o.totalAmount.toFixed(2)} {o.currency}</span>
                      </p>
                      <p className="text-slate-400 text-sm mt-1">
                        {t('Delivery', 'التوصيل')}: {o.city ? `${getCityDisplayName(o.city, lang)} - ` : ''}{(lang === 'ar' && o.deliveryAreaNameAr) ? o.deliveryAreaNameAr : (o.deliveryAreaName || t('Distance-based', 'حسب المسافة'))} - {(o.deliveryAddress || '—')}
                      </p>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setReportOrderId(o.orderId)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors bg-slate-800/50 px-3 py-1.5 rounded-lg"
                        >
                          <Flag className="h-3.5 w-3.5" />
                          {t('Report customer', 'الإبلاغ عن العميل')}
                        </button>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>
        </>
      )}

      {reportOrderId && (
        <ReportFormModal
          open={true}
          onClose={() => setReportOrderId(null)}
          reporterType="driver"
          reportedType="customer"
          orderId={reportOrderId}
          onSuccess={() => setReportOrderId(null)}
        />
      )}
    </div>
  )
}

export default function DriverOrdersPage() {
  return (
    <Suspense fallback={<p className="text-slate-400 text-base p-6">Loading…</p>}>
      <DriverOrdersContent />
    </Suspense>
  )
}
