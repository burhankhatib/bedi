'use client'

import { Suspense, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Store, MapPin, Navigation, Flag, Wallet, Receipt, Truck,
  User, Smartphone, CircleAlert, RefreshCw, ArrowDown, History,
  ChevronDown, Package, Calculator, Phone, Trash2, ShieldCheck,
} from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useLanguage } from '@/components/LanguageContext'
import { useDriverPush } from '../DriverPushContext'
import { useDriverStatus } from '../DriverStatusContext'
import { usePusherStream } from '@/lib/usePusherStream'
import { getWhatsAppUrl } from '@/lib/whatsapp'
import {
  parseCoordsFromGoogleMapsUrl,
  googleMapsNavigationUrl,
  wazeNavigationUrl,
  distanceKm,
} from '@/lib/maps-utils'
import { getCityDisplayName } from '@/lib/registration-translations'
import dynamic from 'next/dynamic'
import { DriverPWAInstall } from './DriverPWAInstall'
import { SlideToComplete } from './SlideToComplete'
import { SlideToPickUp } from './SlideToPickUp'
import { SlideToConfirm } from './SlideToConfirm'
import { SlideToArrive } from './SlideToArrive'
import { ReportFormModal } from '@/components/Reports/ReportFormModal'
import { ChangeCalculatorModal } from './ChangeCalculatorModal'
import { DRIVER_MOTIVATIONAL_QUOTES } from './driverQuotes'

const DriverNavigationMap = dynamic(() => import('./DriverNavigationMap'), {
  ssr: false,
})

/* ─── Types ─────────────────────────────────────────────────────────── */

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
  businessLogoUrl?: string
  businessWhatsapp?: string
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
  driverPickedUpAt?: string
  estimatedDeliveryMinutes?: number
  itemsUpdatedAt?: string
  driverReconfirmedAt?: string
  tipAmount?: number
  tipPercent?: number
  tipSentToDriver?: boolean
  tipIncludedInTotal?: boolean
  tipRemovedByDriver?: boolean
  driverArrivedAt?: string
}

/* ─── Constants & Helpers ───────────────────────────────────────────── */

const NEW_ORDER_SOUND = '/sounds/1.wav'
const MAX_ACTIVE_DELIVERIES = 1
const OFFLINE_PUSH_SENT_KEY = 'driverOfflinePushSent'

function formatDriverOrderNumber(orderNumber: string): string {
  if (!orderNumber || orderNumber.length <= 4) return orderNumber
  const last4 = orderNumber.slice(-4)
  return (orderNumber.startsWith('ORD-') ? 'ORD-...' : '...') + last4
}

const pushDriverLocation = () => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      fetch('/api/driver/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      }).catch(() => {})
    },
    () => {},
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
  )
}

const fmtCurrency = (c: string) =>
  c === 'USD' ? '$' : c === 'EUR' ? '€' : '₪'

const needsReconfirm = (o: DriverOrder) =>
  !!o.itemsUpdatedAt &&
  (!o.driverReconfirmedAt || o.driverReconfirmedAt < o.itemsUpdatedAt)

function getNavUrls(order: DriverOrder) {
  const isDelivering = order.status === 'out-for-delivery'

  if (isDelivering) {
    const dest =
      order.deliveryLat != null && order.deliveryLng != null
        ? { lat: order.deliveryLat, lng: order.deliveryLng }
        : null
    if (dest) {
      return {
        google: googleMapsNavigationUrl(dest),
        waze: wazeNavigationUrl(dest),
      }
    }
    const addr = order.deliveryAddress || 'Customer'
    return {
      google: googleMapsNavigationUrl(addr),
      waze: wazeNavigationUrl(addr),
    }
  }

  let coords: { lat: number; lng: number } | null = null
  if (order.businessLocationLat != null && order.businessLocationLng != null) {
    coords = { lat: order.businessLocationLat, lng: order.businessLocationLng }
  } else {
    coords = parseCoordsFromGoogleMapsUrl(order.businessMapsLink)
  }
  if (coords) {
    return {
      google: googleMapsNavigationUrl(coords),
      waze: wazeNavigationUrl(coords),
    }
  }
  const addr = order.businessAddress || order.businessName || 'Store'
  return {
    google: googleMapsNavigationUrl(addr),
    waze: wazeNavigationUrl(addr),
  }
}

/* ─── Main Component ────────────────────────────────────────────────── */

function DriverOrdersV2Content() {
  const { t, lang } = useLanguage()
  const { showToast } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { hasPush } = useDriverPush()
  const { isOnline, isVerifiedByAdmin, fetchStatus } = useDriverStatus()

  /* go-online deep-link handling */
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

  /* ── state ─────────────────────────────────────────── */
  const [pending, setPending] = useState<DriverOrder[]>([])
  const [myDeliveries, setMyDeliveries] = useState<DriverOrder[]>([])
  const [myCompletedToday, setMyCompletedToday] = useState<DriverOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  const [reportOrderId, setReportOrderId] = useState<string | null>(null)
  const [mapState, setMapState] = useState<'hidden' | 'minimized' | 'maximized'>('hidden')
  const [activeMapOrderId, setActiveMapOrderId] = useState<string | null>(null)
  const [calcOpen, setCalcOpen] = useState(false)
  const [calcOrderTotal, setCalcOrderTotal] = useState(0)
  const [calcCurrency, setCalcCurrency] = useState('ILS')
  const [showCompleted, setShowCompleted] = useState(false)
  const [showBizContact, setShowBizContact] = useState(false)
  const [removeTipConfirmOpen, setRemoveTipConfirmOpen] = useState(false)
  const [removingTip, setRemovingTip] = useState(false)

  const [driverLat, setDriverLat] = useState<number | null>(null)
  const [driverLng, setDriverLng] = useState<number | null>(null)
  const [deliveryNow, setDeliveryNow] = useState(() => Date.now())

  const prevPendingCountRef = useRef(0)
  const declinedOrderIdsRef = useRef<Set<string>>(new Set())
  const acceptedAtRef = useRef<Map<string, number>>(new Map())

  const [startY, setStartY] = useState<number | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const MAX_PULL = 120
  const REFRESH_THRESHOLD = 80

  /* ── always-on driver geolocation (for distance calcs + map) ────── */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDriverLat(pos.coords.latitude)
        setDriverLng(pos.coords.longitude)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setDriverLat(pos.coords.latitude)
        setDriverLng(pos.coords.longitude)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  /* ── fetch orders ─────────────────────────────────────────────────── */
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/driver/orders', { cache: 'no-store' })
      if (res.status === 403) {
        window.location.href = '/suspended?type=driver'
        return
      }
      const data = await res.json()
      if (res.ok && data) {
        const nextPending = (
          Array.isArray(data.pending) ? data.pending : []
        ).filter(
          (o: DriverOrder) => !declinedOrderIdsRef.current.has(o.orderId),
        )
        const nextMy: DriverOrder[] = Array.isArray(data.myDeliveries)
          ? data.myDeliveries
          : []
        const nextCompleted: DriverOrder[] = Array.isArray(
          data.myCompletedToday,
        )
          ? data.myCompletedToday
          : []

        const now = Date.now()
        const keepWindow = 5000
        const justAccepted = nextMy.filter((o) => {
          const ts = acceptedAtRef.current.get(o.orderId)
          return ts != null && now - ts < keepWindow
        })
        const serverIds = new Set(nextMy.map((o) => o.orderId))
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
          } catch (_) {
            /* ignore */
          }
        }
      }
    } catch {
      /* keep previous state */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const prevIsOnlineRef = useRef(isOnline)
  useEffect(() => {
    if (isOnline && !prevIsOnlineRef.current) fetchOrders()
    prevIsOnlineRef.current = isOnline
  }, [isOnline, fetchOrders])

  useEffect(() => {
    const onFocus = () => fetchOrders()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchOrders()
    }
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'PUSH_NOTIFICATION_CLICK') fetchOrders()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onMessage)
    }
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onMessage)
      }
    }
  }, [fetchOrders])

  useEffect(() => {
    if (isOnline) fetchOrders()
  }, [isOnline, fetchOrders])

  usePusherStream('driver-global', 'order-update', fetchOrders, {
    debounceMs: 700,
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !hasPush || isOnline) return
    if (sessionStorage.getItem(OFFLINE_PUSH_SENT_KEY)) return
    sessionStorage.setItem(OFFLINE_PUSH_SENT_KEY, '1')
    fetch('/api/driver/push-send-offline-reminder', { method: 'POST' }).catch(
      () => {},
    )
  }, [hasPush, isOnline])

  /* auto-minimize map when driver is within ~50 m of destination */
  useEffect(() => {
    if (
      mapState === 'maximized' &&
      activeMapOrderId &&
      driverLat &&
      driverLng
    ) {
      const order = myDeliveries.find((o) => o.orderId === activeMapOrderId)
      if (order) {
        const isEnRoute = order.status === 'out-for-delivery'
        const destLat = isEnRoute
          ? order.deliveryLat
          : order.businessLocationLat
        const destLng = isEnRoute
          ? order.deliveryLng
          : order.businessLocationLng
        if (destLat && destLng) {
          const dist = distanceKm(
            { lat: driverLat, lng: driverLng },
            { lat: destLat, lng: destLng },
          )
          if (dist < 0.05) setMapState('minimized')
        }
      }
    }
  }, [driverLat, driverLng, mapState, activeMapOrderId, myDeliveries])

  /* ── derived ───────────────────────────────────────── */
  const activeOrder = myDeliveries[0] || null
  const hasActiveDelivery = myDeliveries.length > 0
  const canAcceptMore = myDeliveries.length < MAX_ACTIVE_DELIVERIES
  const isEnRouteToCustomer = activeOrder?.status === 'out-for-delivery'
  const isAtBusiness =
    activeOrder?.status === 'driver_on_the_way' ||
    activeOrder?.status === 'waiting_for_delivery'

  /* ── delivery countdown tick ────────────────────────── */
  useEffect(() => {
    if (!isEnRouteToCustomer) return
    const id = setInterval(() => setDeliveryNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isEnRouteToCustomer])

  const quoteIndex = useMemo(() => {
    const id = activeOrder?.orderId || ''
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash) % DRIVER_MOTIVATIONAL_QUOTES.length
  }, [activeOrder?.orderId])

  /* ── action handlers ───────────────────────────────── */
  const accept = async (orderId: string) => {
    if (!canAcceptMore) {
      showToast(
        t(
          'You can have at most 1 active delivery.',
          'يمكنك تنفيذ توصيلة نشطة واحدة فقط.',
        ),
        t(
          'You can have at most 1 active delivery.',
          'يمكنك تنفيذ توصيلة نشطة واحدة فقط.',
        ),
        'info',
      )
      return
    }
    const order = pending.find((x) => x.orderId === orderId)
    if (!order) return
    setActionId(orderId)
    setPending((prev) => prev.filter((x) => x.orderId !== orderId))
    setMyDeliveries((prev) => [
      { ...order, status: 'driver_on_the_way' },
      ...prev,
    ])
    acceptedAtRef.current.set(orderId, Date.now())
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/accept`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed')
      }
      showToast(
        t('Order accepted.', 'تم قبول الطلب.'),
        t('Order accepted.', 'تم قبول الطلب.'),
        'success',
      )
      pushDriverLocation()
      setMapState('maximized')
      setActiveMapOrderId(orderId)
    } catch {
      acceptedAtRef.current.delete(orderId)
      setPending((prev) => [order, ...prev])
      setMyDeliveries((prev) => prev.filter((x) => x.orderId !== orderId))
      showToast(
        t('Failed to accept order.', 'فشل قبول الطلب.'),
        t('Failed to accept order.', 'فشل قبول الطلب.'),
        'error',
      )
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
      const res = await fetch(`/api/driver/orders/${orderId}/cancel`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed')
      showToast(
        t('Delivery cancelled.', 'تم إلغاء التوصيل.'),
        t('Delivery cancelled.', 'تم إلغاء التوصيل.'),
        'success',
      )
      if (activeMapOrderId === orderId) {
        setMapState('hidden')
        setActiveMapOrderId(null)
      }
    } catch {
      showToast(
        t('Failed to cancel.', 'فشل الإلغاء.'),
        t('Failed to cancel.', 'فشل الإلغاء.'),
        'error',
      )
    } finally {
      setActionId(null)
    }
  }

  const reconfirm = async (orderId: string) => {
    setActionId(orderId)
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/reconfirm`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed')
      showToast(
        t('Order confirmed.', 'تم التأكيد.'),
        t('Order confirmed.', 'تم التأكيد.'),
        'success',
      )
    } catch {
      showToast(
        t('Failed to confirm.', 'فشل التأكيد.'),
        t('Failed to confirm.', 'فشل التأكيد.'),
        'error',
      )
    } finally {
      setActionId(null)
    }
  }

  const pickUp = async (orderId: string) => {
    const order = myDeliveries.find((x) => x.orderId === orderId)
    if (!order) return
    setActionId(orderId)
    setMyDeliveries((prev) =>
      prev.map((x) =>
        x.orderId === orderId ? { ...x, status: 'out-for-delivery' } : x,
      ),
    )
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/pick-up`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed')
      showToast(
        t('Order picked up.', 'تم استلام الطلب.'),
        t('Order picked up.', 'تم استلام الطلب.'),
        'success',
      )
      pushDriverLocation()
      setActiveMapOrderId(orderId)
      setMapState('maximized')
      fetchOrders()
    } catch {
      setMyDeliveries((prev) =>
        prev.map((x) => (x.orderId === orderId ? order : x)),
      )
      showToast(
        t('Failed to mark as picked up.', 'فشل تسجيل الاستلام.'),
        t('Failed to mark as picked up.', 'فشل تسجيل الاستلام.'),
        'error',
      )
    } finally {
      setActionId(null)
    }
  }

  const complete = async (orderId: string) => {
    const order = myDeliveries.find((x) => x.orderId === orderId)
    if (!order) return
    setActionId(orderId)
    const completedOrder: DriverOrder = {
      ...order,
      status: 'completed',
      completedAt: new Date().toISOString(),
    }
    setMyDeliveries((prev) => prev.filter((x) => x.orderId !== orderId))
    setMyCompletedToday((prev) => [completedOrder, ...prev])
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/complete`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed')
      showToast(
        t('Delivery complete!', 'اكتملت التوصيلة!'),
        t('Delivery complete!', 'اكتملت التوصيلة!'),
        'success',
      )
      pushDriverLocation()
      if (activeMapOrderId === orderId) {
        setMapState('hidden')
        setActiveMapOrderId(null)
      }
    } catch {
      setMyDeliveries((prev) => [order, ...prev])
      setMyCompletedToday((prev) =>
        prev.filter((x) => x.orderId !== orderId),
      )
      showToast(
        t('Failed to complete.', 'فشل تسجيل الإكمال.'),
        t('Failed to complete.', 'فشل تسجيل الإكمال.'),
        'error',
      )
    } finally {
      setActionId(null)
    }
  }

  const arrive = async (orderId: string) => {
    const order = myDeliveries.find((x) => x.orderId === orderId)
    if (!order) return
    if (
      driverLat != null &&
      driverLng != null &&
      order.deliveryLat != null &&
      order.deliveryLng != null
    ) {
      const dist = distanceKm(
        { lat: driverLat, lng: driverLng },
        { lat: order.deliveryLat, lng: order.deliveryLng }
      )
      if (dist > 0.1) {
        showToast(
          t(
            `You are ${Math.round(dist * 1000)}m away. Must be within 100m.`,
            `أنت على بعد ${Math.round(dist * 1000)} متر. يجب أن تكون ضمن 100 متر.`
          ),
          t(
            `You are ${Math.round(dist * 1000)}m away. Must be within 100m.`,
            `أنت على بعد ${Math.round(dist * 1000)} متر. يجب أن تكون ضمن 100 متر.`
          ),
          'info'
        )
        return
      }
    }
    setActionId(orderId)
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/arrived`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: driverLat, lng: driverLng }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed')
      }
      showToast(
        t('Arrival confirmed!', 'تم تأكيد الوصول!'),
        t('Arrival confirmed!', 'تم تأكيد الوصول!'),
        'success'
      )
      pushDriverLocation()
      fetchOrders()
    } catch (e: any) {
      const msg = e?.message || ''
      if (msg.includes('Too far')) {
        showToast(
          t('Too far from customer. Get closer first.', 'بعيد عن العميل. اقترب أكثر أولاً.'),
          t('Too far from customer. Get closer first.', 'بعيد عن العميل. اقترب أكثر أولاً.'),
          'error'
        )
      } else {
        showToast(
          t('Failed to confirm arrival.', 'فشل تأكيد الوصول.'),
          t('Failed to confirm arrival.', 'فشل تأكيد الوصول.'),
          'error'
        )
      }
    } finally {
      setActionId(null)
    }
  }

  const removeTip = async (orderId: string) => {
    setRemovingTip(true)
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/remove-tip`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed')
      }
      showToast(
        t('Tip removed from total.', 'تمت إزالة الإكرامية من المجموع.'),
        t('Tip removed from total.', 'تمت إزالة الإكرامية من المجموع.'),
        'success'
      )
      setRemoveTipConfirmOpen(false)
      fetchOrders()
    } catch {
      showToast(
        t('Could not remove tip. Try again.', 'تعذّرت إزالة الإكرامية. حاول مرة أخرى.'),
        t('Could not remove tip. Try again.', 'تعذّرت إزالة الإكرامية. حاول مرة أخرى.'),
        'error'
      )
    } finally {
      setRemovingTip(false)
    }
  }

  /* ── registration banner ───────────────────────────── */
  const justRegistered = searchParams.get('registered') === '1'
  const [dismissedRegistered, setDismissedRegistered] = useState(false)
  const showJustRegistered = justRegistered && !dismissedRegistered

  /* ── pull-to-refresh ───────────────────────────────── */
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 0) setStartY(e.touches[0].clientY)
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY !== null && window.scrollY <= 0) {
      const dist = e.touches[0].clientY - startY
      if (dist > 0) setPullDistance(Math.min(dist * 0.5, MAX_PULL))
    }
  }
  const handleTouchEnd = async () => {
    if (pullDistance > REFRESH_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true)
      setPullDistance(REFRESH_THRESHOLD)
      await fetchOrders()
      setIsRefreshing(false)
    }
    setPullDistance(0)
    setStartY(null)
  }

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  RENDER                                                            */
  /* ═══════════════════════════════════════════════════════════════════ */
  return (
    <div
      className="relative touch-pan-y space-y-5"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ─── Pull-to-refresh indicator ─────────────────── */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-50"
        style={{ height: 0 }}
        animate={{
          y: isRefreshing ? REFRESH_THRESHOLD / 2 : pullDistance / 2,
          opacity: pullDistance > 10 || isRefreshing ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div className="bg-slate-800 border border-slate-700 rounded-full px-4 py-2 shadow-lg flex items-center justify-center -mt-6 gap-2">
          <motion.div
            animate={{
              rotate: isRefreshing
                ? 360
                : pullDistance > REFRESH_THRESHOLD
                  ? 180
                  : 0,
            }}
            transition={
              isRefreshing
                ? { repeat: Infinity, duration: 1, ease: 'linear' }
                : { type: 'spring', stiffness: 200, damping: 20 }
            }
          >
            {isRefreshing ? (
              <RefreshCw className="w-5 h-5 text-emerald-400" />
            ) : (
              <ArrowDown
                className={`w-5 h-5 ${pullDistance > REFRESH_THRESHOLD ? 'text-emerald-400' : 'text-slate-400'}`}
              />
            )}
          </motion.div>
          {!isRefreshing && pullDistance > 0 && (
            <span
              className={`text-sm font-bold ${pullDistance > REFRESH_THRESHOLD ? 'text-emerald-400' : 'text-slate-400'}`}
            >
              {pullDistance > REFRESH_THRESHOLD
                ? t('Release to refresh', 'أفلت للتحديث')
                : t('Pull to refresh', 'اسحب للتحديث')}
            </span>
          )}
          {isRefreshing && (
            <span className="text-sm font-bold text-emerald-400">
              {t('Refreshing...', 'جاري التحديث...')}
            </span>
          )}
        </div>
      </motion.div>

      {/* ─── Registration Banner ────────────────────────── */}
      {showJustRegistered && (
        <div
          className="rounded-xl border-2 border-amber-600/50 bg-amber-950/30 p-5"
          role="region"
          aria-label={t(
            'Next steps after registration',
            'الخطوات التالية بعد التسجيل',
          )}
        >
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/30 border border-amber-500/50"
              aria-hidden
            >
              <Smartphone className="h-7 w-7 text-amber-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-amber-100 text-lg mb-1">
                {t(
                  'You\u2019re all set! Do this next:',
                  'تم التسجيل! افعل التالي:',
                )}
              </p>
              <p className="text-amber-200/95 text-sm mb-4">
                {t(
                  'Enable notifications below to get new orders. Then install the app from this page so you get the correct driver app.',
                  'فعّل الإشعارات أدناه لاستقبال الطلبات. ثم ثبّت التطبيق من هذه الصفحة لتحصل على تطبيق السائق الصحيح.',
                )}
              </p>
              <div className="rounded-lg bg-amber-900/40 border border-amber-600/40 p-3 mb-3">
                <p className="font-semibold text-amber-200 text-sm mb-2 flex items-center gap-2">
                  <CircleAlert className="h-4 w-4 shrink-0" />
                  {t(
                    'Important: Install from this page',
                    'مهم: ثبّت من هذه الصفحة',
                  )}
                </p>
                <p className="text-xs text-amber-200/90 mb-3">
                  {t(
                    'If you install from another page you may get the wrong app. Stay here and use the install steps below.',
                    'إذا ثبّت من صفحة أخرى قد تحصل على تطبيق خاطئ. ابقَ هنا واستخدم خطوات التثبيت أدناه.',
                  )}
                </p>
                <ul className="text-sm text-amber-200/90 space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600/50 text-amber-100 text-xs font-bold">
                      1
                    </span>
                    {t(
                      'Android: tap Install when it appears below, or menu (\u22EE) \u2192 Add to Home screen.',
                      'Android: اضغط تثبيت عند ظهوره أدناه، أو القائمة (\u22EE) \u2190 إضافة إلى الشاشة الرئيسية.',
                    )}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600/50 text-amber-100 text-xs font-bold">
                      2
                    </span>
                    {t(
                      'iPhone: Share \u2192 Add to Home Screen, then open from home screen.',
                      'iPhone: مشاركة \u2190 إضافة إلى الشاشة الرئيسية، ثم افتح من الشاشة الرئيسية.',
                    )}
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

      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="font-black text-xl text-white sm:text-2xl">
          {t('Delivery orders', 'طلبات التوصيل')}
        </h1>
        {hasActiveDelivery && (
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
            {isEnRouteToCustomer
              ? t('Delivering', 'جاري التوصيل')
              : t('Active', 'نشطة')}
          </span>
        )}
      </div>

      {/* ─── Loading ────────────────────────────────────── */}
      {loading &&
      pending.length === 0 &&
      myDeliveries.length === 0 &&
      myCompletedToday.length === 0 ? (
        <p className="text-slate-400 text-base">
          {t('Loading\u2026', 'جاري التحميل...')}
        </p>
      ) : hasActiveDelivery && activeOrder ? (
        /* ══════════════════════════════════════════════════ */
        /*  ACTIVE DELIVERY CARD                             */
        /* ══════════════════════════════════════════════════ */
        <AnimatePresence mode="wait">
          <motion.div
            key={activeOrder.orderId + '-' + activeOrder.status}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="rounded-3xl border-2 border-emerald-700/80 bg-emerald-950/20 p-4 sm:p-5 shadow-sm"
          >
            {/* Navigation Bar (Waze / Maps / Open Map) */}
            {mapState !== 'maximized' &&
              (() => {
                const urls = getNavUrls(activeOrder)
                return (
                  <div className="flex items-center gap-2 mb-4">
                    <a
                      href={urls.google}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 text-sm min-h-[52px] shadow-md active:scale-[0.97] transition-all"
                    >
                      <Navigation className="w-4 h-4 shrink-0" />
                      Maps
                    </a>
                    <a
                      href={urls.waze}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-bold py-3.5 text-sm min-h-[52px] shadow-md active:scale-[0.97] transition-all"
                    >
                      <Navigation className="w-4 h-4 shrink-0" />
                      Waze
                    </a>
                    <button
                      onClick={() => {
                        setActiveMapOrderId(activeOrder.orderId)
                        setMapState('maximized')
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-slate-700 hover:bg-slate-600 border border-slate-600 text-emerald-400 font-bold py-3.5 text-sm min-h-[52px] shadow-md active:scale-[0.97] transition-all"
                    >
                      <MapPin className="w-4 h-4 shrink-0 animate-pulse" />
                      {t('Map', 'خريطة')}
                    </button>
                  </div>
                )
              })()}

            {/* Reconfirm Banner (when business updates the order) */}
            {needsReconfirm(activeOrder) && (
              <div className="rounded-3xl border border-amber-500/40 bg-amber-950/30 p-4 mb-4">
                <p className="text-amber-200 font-semibold text-sm mb-2">
                  {t(
                    'Order was updated by the business. New amount to pay:',
                    'تم تحديث الطلب من قبل المتجر. المبلغ الجديد المطلوب دفعه:',
                  )}
                </p>
                <p className="text-amber-100 font-bold text-lg mb-3">
                  {activeOrder.amountToPayTenant.toFixed(2)}{' '}
                  {activeOrder.currency} {t('to', 'إلى')}{' '}
                  {activeOrder.businessName}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => reconfirm(activeOrder.orderId)}
                    disabled={actionId === activeOrder.orderId}
                    className="rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-3 text-sm disabled:opacity-70 shadow-sm"
                  >
                    {actionId === activeOrder.orderId
                      ? t('Confirming\u2026', 'جاري التأكيد\u2026')
                      : t('Confirm', 'تأكيد')}
                  </button>
                  <button
                    onClick={() => cancel(activeOrder.orderId)}
                    disabled={actionId === activeOrder.orderId}
                    className="rounded-2xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-5 py-3 text-sm disabled:opacity-70"
                  >
                    {t('Decline', 'رفض')}
                  </button>
                </div>
              </div>
            )}

            {/* ── Phase B: At Business ─────────────────── */}
            {isAtBusiness && !needsReconfirm(activeOrder) && (
              <>
                <div className="mb-4 text-center">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                    {t('Order Number', 'رقم الطلب')}
                  </p>
                  <span className="font-mono text-3xl font-black text-emerald-400 tracking-widest">
                    #{formatDriverOrderNumber(activeOrder.orderNumber)}
                  </span>
                </div>

                {(activeOrder.customerName || activeOrder.customerPhone) && (
                  <div className="rounded-3xl bg-slate-800/40 border border-slate-700/50 p-4 mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700/50 text-slate-300">
                        <User className="h-5 w-5" />
                      </div>
                      <span className="font-bold text-slate-100 text-lg">
                        {activeOrder.customerName || '\u2014'}
                      </span>
                    </div>
                    {activeOrder.customerPhone && (
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`tel:${activeOrder.customerPhone.replace(/\s/g, '')}`}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold px-4 py-3 min-h-[48px] transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          {activeOrder.customerPhone}
                        </a>
                        {getWhatsAppUrl(activeOrder.customerPhone) && (
                          <a
                            href={getWhatsAppUrl(activeOrder.customerPhone)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-bold px-4 py-3 min-h-[48px] transition-colors"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Business contact (collapsible) */}
                <div className="rounded-3xl bg-slate-800/40 border border-slate-700/50 overflow-hidden mb-4">
                  <button
                    type="button"
                    onClick={() => setShowBizContact((p) => !p)}
                    className="w-full flex items-center justify-between px-4 py-3 focus:outline-none"
                  >
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-300">
                      <Store className="h-4 w-4 text-amber-400" />
                      {activeOrder.businessName}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${showBizContact ? 'rotate-180' : ''}`} />
                  </button>
                  {showBizContact && activeOrder.businessWhatsapp && (
                    <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
                      <a
                        href={`tel:${activeOrder.businessWhatsapp.replace(/\s/g, '')}`}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold px-4 py-3 min-h-[48px] transition-colors text-sm"
                      >
                        <Phone className="w-4 h-4" />
                        {t('Call', 'اتصال')}
                      </a>
                      {getWhatsAppUrl(activeOrder.businessWhatsapp) && (
                        <a
                          href={getWhatsAppUrl(activeOrder.businessWhatsapp)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-bold px-4 py-3 min-h-[48px] transition-colors text-sm"
                        >
                          WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <SlideToPickUp
                  orderId={activeOrder.orderId}
                  onPickUp={pickUp}
                  disabled={!!actionId}
                />

                <div className="mt-4 flex flex-wrap items-center justify-between px-2 gap-4">
                  <button
                    onClick={() => setReportOrderId(activeOrder.orderId)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <Flag className="h-4 w-4" />
                    {t('Report customer', 'الإبلاغ عن العميل')}
                  </button>
                  <button
                    onClick={() => cancel(activeOrder.orderId)}
                    disabled={actionId === activeOrder.orderId}
                    className="text-xs font-semibold text-rose-500/80 hover:text-rose-400 transition-colors underline underline-offset-4"
                  >
                    {actionId === activeOrder.orderId
                      ? t('Cancelling\u2026', 'جاري الإلغاء\u2026')
                      : t('Cancel delivery', 'إلغاء التوصيل')}
                  </button>
                </div>
              </>
            )}

            {/* ── Phase C: Delivering to Customer ──────── */}
            {isEnRouteToCustomer && !needsReconfirm(activeOrder) && (
              <>
                {(activeOrder.customerName || activeOrder.customerPhone) && (
                  <div className="rounded-3xl bg-slate-800/40 border border-slate-700/50 p-4 mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700/50 text-slate-300">
                        <User className="h-5 w-5" />
                      </div>
                      <span className="font-bold text-slate-100 text-lg">
                        {activeOrder.customerName || '\u2014'}
                      </span>
                    </div>
                    {activeOrder.customerPhone && (
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`tel:${activeOrder.customerPhone.replace(/\s/g, '')}`}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold px-4 py-3 min-h-[48px] transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          {activeOrder.customerPhone}
                        </a>
                        {getWhatsAppUrl(activeOrder.customerPhone) && (
                          <a
                            href={getWhatsAppUrl(activeOrder.customerPhone)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-bold px-4 py-3 min-h-[48px] transition-colors"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Business contact (collapsible) */}
                <div className="rounded-3xl bg-slate-800/40 border border-slate-700/50 overflow-hidden mb-4">
                  <button
                    type="button"
                    onClick={() => setShowBizContact((p) => !p)}
                    className="w-full flex items-center justify-between px-4 py-3 focus:outline-none"
                  >
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-300">
                      <Store className="h-4 w-4 text-amber-400" />
                      {activeOrder.businessName}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${showBizContact ? 'rotate-180' : ''}`} />
                  </button>
                  {showBizContact && activeOrder.businessWhatsapp && (
                    <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
                      <a
                        href={`tel:${activeOrder.businessWhatsapp.replace(/\s/g, '')}`}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold px-4 py-3 min-h-[48px] transition-colors text-sm"
                      >
                        <Phone className="w-4 h-4" />
                        {t('Call', 'اتصال')}
                      </a>
                      {getWhatsAppUrl(activeOrder.businessWhatsapp) && (
                        <a
                          href={getWhatsAppUrl(activeOrder.businessWhatsapp)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-bold px-4 py-3 min-h-[48px] transition-colors text-sm"
                        >
                          WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Delivery Countdown + Motivational Quote + Safety */}
                {activeOrder.driverArrivedAt ? (
                  <div className="rounded-3xl bg-gradient-to-b from-emerald-900/30 to-slate-900/40 border border-emerald-500/30 p-5 mb-4 text-center">
                    <p className="text-emerald-400 font-black text-xl mb-1">
                      ✅ {t('You have arrived!', 'لقد وصلت!')}
                    </p>
                    <p className="text-slate-400 text-sm">
                      {t('Hand over the order and complete the delivery.', 'سلّم الطلب وأكمل التوصيل.')}
                    </p>
                  </div>
                ) : activeOrder.estimatedDeliveryMinutes && activeOrder.driverPickedUpAt ? (() => {
                  const pickupMs = new Date(activeOrder.driverPickedUpAt!).getTime()
                  const targetMs = pickupMs + activeOrder.estimatedDeliveryMinutes! * 60 * 1000
                  const remainMs = targetMs - deliveryNow
                  const isOverdue = remainMs <= 0
                  const cdMinutes = isOverdue ? 0 : Math.floor(remainMs / 60000)
                  const cdSeconds = isOverdue ? 0 : Math.floor((remainMs % 60000) / 1000)

                  return (
                    <div className="rounded-3xl bg-gradient-to-b from-purple-900/30 to-slate-900/40 border border-purple-500/30 p-5 mb-4">
                      <div className="text-center mb-4">
                        <p className="text-purple-300/80 text-xs font-semibold uppercase tracking-wider mb-2">
                          {t('Time remaining', 'الوقت المتبقي للتوصيل')}
                        </p>
                        {isOverdue ? (
                          <p className="text-amber-400 font-bold text-lg animate-pulse">
                            ⏰ {t('Deliver now!', 'وصّل الآن!')}
                          </p>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <div className="bg-purple-500/20 rounded-2xl px-5 py-2 text-center min-w-[75px]">
                              <span className="text-3xl font-black text-purple-300 tabular-nums block">
                                {String(cdMinutes).padStart(2, '0')}
                              </span>
                              <span className="text-[10px] font-bold text-purple-400/60 uppercase tracking-wider">
                                {t('min', 'دقيقة')}
                              </span>
                            </div>
                            <span className="text-2xl font-black text-purple-400/40">:</span>
                            <div className="bg-purple-500/20 rounded-2xl px-5 py-2 text-center min-w-[75px]">
                              <span className="text-3xl font-black text-purple-300 tabular-nums block">
                                {String(cdSeconds).padStart(2, '0')}
                              </span>
                              <span className="text-[10px] font-bold text-purple-400/60 uppercase tracking-wider">
                                {t('sec', 'ثانية')}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-center px-2 mb-4">
                        <p className="text-slate-300/80 text-sm leading-relaxed italic">
                          {DRIVER_MOTIVATIONAL_QUOTES[quoteIndex]}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                        <p className="text-amber-300/80 text-xs font-medium leading-relaxed">
                          🛡️ {t(
                            'Drive safe and stay alert at all times. Your safety and the safety of others matter most. Handle the order with care.',
                            'سُق بأمان وانتبه على الطريق دائماً. سلامتك وسلامة الآخرين أهم من أي توصيلة. وصّل الطلب بعناية.'
                          )} 🤲
                        </p>
                      </div>
                    </div>
                  )
                })() : isEnRouteToCustomer && (
                  <div className="rounded-3xl bg-purple-900/20 border border-purple-500/20 p-4 mb-4 text-center">
                    <p className="text-purple-300/60 text-sm animate-pulse">
                      {t('Calculating delivery time…', 'جاري حساب وقت التوصيل…')}
                    </p>
                  </div>
                )}

                {/* Total to collect — BIG */}
                {(() => {
                  const tipActive = activeOrder.tipIncludedInTotal && (activeOrder.tipAmount ?? 0) > 0 && !activeOrder.tipRemovedByDriver
                  const collectTotal = tipActive
                    ? activeOrder.totalAmount + (activeOrder.tipAmount ?? 0)
                    : activeOrder.totalAmount
                  return (
                    <div className="rounded-3xl bg-emerald-500/10 border border-emerald-500/30 p-5 mb-4 text-center">
                      <p className="text-emerald-300/80 text-sm font-semibold mb-1">
                        {tipActive
                          ? t('Collect from Customer (incl. tip)', 'حصّل من العميل (شامل الإكرامية)')
                          : t('Collect from Customer', 'حصّل من العميل')}
                      </p>
                      <AnimatePresence mode="popLayout">
                        <motion.p
                          key={collectTotal.toFixed(2)}
                          initial={{ y: -10, opacity: 0, scale: 0.9 }}
                          animate={{ y: 0, opacity: 1, scale: 1 }}
                          exit={{ y: 10, opacity: 0, scale: 0.9 }}
                          transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                          className={`text-5xl font-black tabular-nums ${tipActive ? 'text-emerald-300' : 'text-emerald-400'}`}
                        >
                          {collectTotal.toFixed(2)}
                        </motion.p>
                      </AnimatePresence>
                      <p className="text-emerald-300/60 text-lg font-bold">
                        {fmtCurrency(activeOrder.currency)}
                      </p>

                      {/* Tip breakdown when included in total */}
                      {tipActive && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          transition={{ duration: 0.3 }}
                          className="mt-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-left"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            <p className="text-emerald-300/80 text-xs font-bold">
                              {t('Amount breakdown', 'تفصيل المبلغ')}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">{t('Order', 'الطلب')}</span>
                              <span className="text-emerald-400 font-medium tabular-nums">{activeOrder.totalAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-rose-400">💚 {t('Tip', 'إكرامية')} ({activeOrder.tipPercent ?? 0}%)</span>
                              <span className="text-rose-400 font-medium tabular-nums">+{(activeOrder.tipAmount ?? 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold pt-1 border-t border-emerald-500/20">
                              <span className="text-emerald-300">{t('Total', 'المجموع')}</span>
                              <span className="text-emerald-300 tabular-nums">{collectTotal.toFixed(2)} {fmtCurrency(activeOrder.currency)}</span>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Tip pending (sent but not yet included in total) */}
                      {activeOrder.tipSentToDriver && (activeOrder.tipAmount ?? 0) > 0 && !activeOrder.tipIncludedInTotal && !activeOrder.tipRemovedByDriver && (
                        <div className="mt-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3">
                          <p className="text-rose-300/80 text-xs font-medium mb-1">
                            💚 {t('Customer tip (gesture of appreciation)', 'إكرامية العميل (لفتة تقدير)')}
                          </p>
                          <p className="text-2xl font-black text-rose-400 tabular-nums">
                            +{(activeOrder.tipAmount ?? 0).toFixed(2)} {fmtCurrency(activeOrder.currency)}
                          </p>
                          <p className="text-rose-300/50 text-[10px] mt-1 leading-relaxed">
                            {t(
                              'This is a voluntary gesture from the customer — not required. The customer may change their mind.',
                              'هذه لفتة تطوعية من العميل — ليست إلزامية. يمكن للعميل أن يغيّر رأيه.'
                            )}
                          </p>
                        </div>
                      )}

                      {/* Tip removed by driver badge */}
                      {activeOrder.tipRemovedByDriver && (
                        <div className="mt-3 rounded-2xl bg-slate-800/50 border border-slate-600/30 p-3">
                          <p className="text-slate-400 text-xs font-medium">
                            {t('You removed the tip from this order.', 'لقد أزلت الإكرامية من هذا الطلب.')}
                          </p>
                        </div>
                      )}

                      {/* Remove tip button — only when tip is active and order is not completed */}
                      {tipActive && activeOrder.status !== 'completed' && (
                        <motion.button
                          type="button"
                          onClick={() => setRemoveTipConfirmOpen(true)}
                          whileTap={{ scale: 0.95 }}
                          className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-rose-900/30 hover:bg-rose-900/50 border border-rose-500/30 text-rose-400 font-semibold px-4 py-2.5 text-xs min-h-[40px] transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('Remove tip from total', 'إزالة الإكرامية من المجموع')}
                        </motion.button>
                      )}

                      <button
                        onClick={() => {
                          setCalcOrderTotal(collectTotal)
                          setCalcCurrency(activeOrder.currency)
                          setCalcOpen(true)
                        }}
                        className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold px-5 py-3 text-sm min-h-[48px] active:scale-[0.97] transition-all"
                      >
                        <Calculator className="w-5 h-5 text-amber-400" />
                        {t('Change Calculator', 'حاسبة الباقي')}
                      </button>
                    </div>
                  )
                })()}

                {/* Remove tip confirmation modal */}
                <AnimatePresence>
                  {removeTipConfirmOpen && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
                      onClick={() => setRemoveTipConfirmOpen(false)}
                    >
                      <motion.div
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.85, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="bg-gradient-to-b from-amber-600 to-amber-700 px-6 pt-5 pb-4 text-white">
                          <div className="flex items-center gap-3">
                            <Trash2 className="w-6 h-6 shrink-0" />
                            <h3 className="text-lg font-black">
                              {t('Remove tip?', 'إزالة الإكرامية؟')}
                            </h3>
                          </div>
                          <p className="text-sm text-white/80 mt-1.5 leading-relaxed">
                            {t(
                              'Are you sure you want to remove the customer\'s tip? This will update the total for both you and the customer.',
                              'هل أنت متأكد من إزالة إكرامية العميل؟ سيتم تحديث المجموع لك وللعميل.'
                            )}
                          </p>
                        </div>
                        <div className="px-6 py-5 flex gap-3">
                          <motion.button
                            type="button"
                            onClick={() => removeTip(activeOrder.orderId)}
                            disabled={removingTip}
                            whileTap={{ scale: 0.95 }}
                            className="flex-1 py-3.5 rounded-2xl font-bold text-sm bg-red-500 text-white shadow-lg shadow-red-500/20 disabled:opacity-60 transition-all"
                          >
                            {removingTip
                              ? t('Removing…', 'جاري الإزالة…')
                              : t('Yes, remove tip', 'نعم، أزل الإكرامية')}
                          </motion.button>
                          <motion.button
                            type="button"
                            onClick={() => setRemoveTipConfirmOpen(false)}
                            whileTap={{ scale: 0.95 }}
                            className="flex-1 py-3.5 rounded-2xl font-bold text-sm bg-slate-700 text-white transition-all hover:bg-slate-600"
                          >
                            {t('Keep tip', 'أبقِ الإكرامية')}
                          </motion.button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Slide to arrive (when within ~100m of customer and not yet arrived) */}
                {!activeOrder.driverArrivedAt && (
                  <SlideToArrive
                    orderId={activeOrder.orderId}
                    onArrive={arrive}
                    disabled={!!actionId}
                  />
                )}

                <SlideToComplete
                  orderId={activeOrder.orderId}
                  onComplete={complete}
                  disabled={!!actionId}
                />

                <div className="mt-4 flex flex-wrap items-center justify-between px-2 gap-4">
                  <button
                    onClick={() => setReportOrderId(activeOrder.orderId)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <Flag className="h-4 w-4" />
                    {t('Report customer', 'الإبلاغ عن العميل')}
                  </button>
                  <button
                    onClick={() => cancel(activeOrder.orderId)}
                    disabled={actionId === activeOrder.orderId}
                    className="text-xs font-semibold text-rose-500/80 hover:text-rose-400 transition-colors underline underline-offset-4"
                  >
                    {actionId === activeOrder.orderId
                      ? t('Cancelling\u2026', 'جاري الإلغاء\u2026')
                      : t('Cancel delivery', 'إلغاء التوصيل')}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      ) : pending.length > 0 ? (
        /* ══════════════════════════════════════════════════ */
        /*  PENDING (NEW) ORDERS                             */
        /* ══════════════════════════════════════════════════ */
        <ul className="space-y-4">
          <AnimatePresence initial={false}>
            {pending.map((o) => {
              const driverToBusinessKm =
                driverLat != null &&
                driverLng != null &&
                o.businessLocationLat != null &&
                o.businessLocationLng != null
                  ? distanceKm(
                      { lat: driverLat, lng: driverLng },
                      { lat: o.businessLocationLat, lng: o.businessLocationLng },
                    )
                  : null

              const businessToCustomerKm =
                o.businessLocationLat != null &&
                o.businessLocationLng != null &&
                o.deliveryLat != null &&
                o.deliveryLng != null
                  ? distanceKm(
                      {
                        lat: o.businessLocationLat,
                        lng: o.businessLocationLng,
                      },
                      { lat: o.deliveryLat, lng: o.deliveryLng },
                    )
                  : null

              return (
                <motion.li
                  key={o.orderId}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="rounded-3xl border border-slate-700/60 bg-slate-900/90 p-4 sm:p-5 shadow-sm"
                >
                  {/* Small order badge */}
                  <div className="mb-3">
                    <span className="font-mono text-sm font-bold text-slate-400 bg-slate-800/80 px-3 py-1 rounded-lg">
                      #{formatDriverOrderNumber(o.orderNumber)}
                    </span>
                  </div>

                  {/* ── Financial Summary ─────────────────── */}
                  <div className="rounded-3xl border border-slate-700/60 bg-slate-800/30 p-4 mb-4 space-y-3">
                    {/* Pay to Business */}
                    <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-amber-200/80 text-sm font-medium">
                          {t('You need to pay', 'المبلغ المطلوب دفعه')}
                        </p>
                        <p className="font-black text-amber-400 text-lg">
                          {o.amountToPayTenant.toFixed(2)}{' '}
                          {fmtCurrency(o.currency)}{' '}
                          <span className="text-amber-200/60 text-base font-medium mx-1">
                            {t('to', 'إلى')}
                          </span>{' '}
                          {o.businessName}
                        </p>
                      </div>
                    </div>
                    {/* Driver Fee + Total from Customer */}
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-6 rounded-2xl bg-sky-500/10 border border-sky-500/20 p-3.5 flex flex-col gap-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Truck className="h-4 w-4 text-sky-400 shrink-0" />
                          <span className="text-sky-200/80 text-xs font-semibold">
                            {t('Delivery fee', 'سعر التوصيل')}
                          </span>
                        </div>
                        <span className="font-black text-sky-400 text-lg">
                          {o.deliveryFee.toFixed(2)} {fmtCurrency(o.currency)}
                        </span>
                      </div>
                      <div className="col-span-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 flex flex-col gap-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Receipt className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span className="text-emerald-200/80 text-xs font-semibold truncate">
                            {t('Total from', 'المجموع من')}{' '}
                            {(o.customerName || '').trim().split(/\s+/)[0] ||
                              t('client', 'العميل')}
                          </span>
                        </div>
                        <span className="font-black text-emerald-400 text-xl">
                          {o.totalAmount.toFixed(2)} {fmtCurrency(o.currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Business (Pickup) Location ─────────── */}
                  <div className="rounded-3xl bg-slate-800/40 border border-slate-700/50 p-4 mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                        <Store className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                          {t('Pickup from', 'استلام من')}
                        </p>
                        <p className="font-bold text-slate-100 text-base truncate">
                          {o.businessName}
                        </p>
                      </div>
                    </div>
                    <p className="text-slate-300 text-[15px] leading-relaxed ml-[52px] rtl:mr-[52px] rtl:ml-0">
                      {lang === 'ar' && (o.businessAddressAr || '').trim()
                        ? o.businessAddressAr
                        : o.businessAddress || o.businessName || '\u2014'}
                    </p>
                    {driverToBusinessKm != null && (
                      <p className="ml-[52px] rtl:mr-[52px] rtl:ml-0 mt-1.5">
                        <span className="inline-flex items-center gap-1.5 text-amber-400 text-sm font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg">
                          <MapPin className="w-3.5 h-3.5" />
                          {driverToBusinessKm.toFixed(1)}{' '}
                          {t('km from you', 'كم منك')}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* ── Customer (Delivery) Location ────────── */}
                  <div className="rounded-3xl bg-slate-800/40 border border-slate-700/50 p-4 mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <span className="font-bold text-slate-200 text-base">
                        {t('Deliver to', 'توصيل إلى')}
                      </span>
                    </div>
                    <div className="text-slate-300 text-[15px] leading-relaxed ml-[52px] rtl:mr-[52px] rtl:ml-0 space-y-1">
                      {o.city && <p>{getCityDisplayName(o.city, lang)}</p>}
                      <p>
                        <span className="font-semibold">
                          {t('Area:', 'المنطقة:')}
                        </span>{' '}
                        {o.deliveryAreaName || o.deliveryAreaNameAr
                          ? lang === 'ar' && o.deliveryAreaNameAr
                            ? o.deliveryAreaNameAr
                            : o.deliveryAreaName
                          : t('Distance-based', 'حسب المسافة')}
                      </p>
                      <p>
                        <span className="font-semibold">
                          {t('Address:', 'العنوان:')}
                        </span>{' '}
                        {o.deliveryAddress || '\u2014'}
                      </p>
                    </div>
                    {businessToCustomerKm != null && (
                      <p className="ml-[52px] rtl:mr-[52px] rtl:ml-0 mt-2">
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 text-sm font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                          <Navigation className="w-3.5 h-3.5" />
                          {businessToCustomerKm.toFixed(1)}{' '}
                          {t('km from business', 'كم من المتجر')}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* ── Accept / Decline ────────────────────── */}
                  <div className="flex flex-col gap-3">
                    {!canAcceptMore && (
                      <p className="rounded-2xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-amber-200/90 text-sm font-medium">
                        {t(
                          'Complete or cancel your current delivery to accept.',
                          'أكمِل أو ألغِ توصيلتك الحالية لقبول طلبات جديدة.',
                        )}
                      </p>
                    )}
                    <SlideToConfirm
                      orderId={o.orderId}
                      variant="accept"
                      onConfirm={accept}
                      disabled={!!actionId || !canAcceptMore}
                    />
                    <SlideToConfirm
                      orderId={o.orderId}
                      variant="decline"
                      onConfirm={decline}
                      disabled={!!actionId}
                    />
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      ) : (
        /* ══════════════════════════════════════════════════ */
        /*  IDLE — NO ORDERS                                 */
        /* ══════════════════════════════════════════════════ */
        <div className="text-center py-12">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Package className="w-8 h-8 text-slate-500" />
            </div>
          </div>
          <p className="text-slate-400 text-base font-medium">
            {t('No orders right now.', 'لا توجد طلبات الآن.')}
          </p>
          <p className="text-slate-500 text-sm mt-1">
            {t(
              'Stay online to receive new orders.',
              'ابقَ متصلًا لاستقبال طلبات جديدة.',
            )}
          </p>
        </div>
      )}

      {/* ─── Completed Today (collapsible, only when idle) ─── */}
      {!hasActiveDelivery && myCompletedToday.length > 0 && (
        <section className="mt-2">
          <button
            onClick={() => setShowCompleted((p) => !p)}
            className="w-full flex items-center justify-between py-3 px-1 text-slate-400 hover:text-slate-300 transition-colors"
          >
            <span className="flex items-center gap-2 font-bold text-sm">
              <History className="h-4 w-4" />
              {t('Completed today', 'تم اليوم')} ({myCompletedToday.length})
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${showCompleted ? 'rotate-180' : ''}`}
            />
          </button>
          <AnimatePresence>
            {showCompleted && (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-2 overflow-hidden"
              >
                {myCompletedToday.map((o) => (
                  <li
                    key={o.orderId}
                    className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3.5"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm font-bold text-slate-300">
                        #{formatDriverOrderNumber(o.orderNumber)}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {o.businessName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-slate-300 text-sm">
                        {t('Total', 'المجموع')}{' '}
                        <span className="text-white font-bold">
                          {o.totalAmount.toFixed(2)} {fmtCurrency(o.currency)}
                        </span>
                        {(o.tipAmount ?? 0) > 0 && (
                          <span className="text-rose-400 font-semibold ml-2">
                            💚 +{(o.tipAmount ?? 0).toFixed(2)}
                          </span>
                        )}
                      </p>
                      <button
                        onClick={() => setReportOrderId(o.orderId)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        <Flag className="h-3 w-3" />
                        {t('Report', 'إبلاغ')}
                      </button>
                    </div>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* ─── Report Modal ──────────────────────────────── */}
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

      {/* ─── Change Calculator Modal ───────────────────── */}
      <ChangeCalculatorModal
        open={calcOpen}
        onClose={() => setCalcOpen(false)}
        orderTotal={calcOrderTotal}
        currency={calcCurrency}
      />

      {/* ─── Full-screen Navigation Map Overlay ────────── */}
      {mapState === 'maximized' &&
        activeMapOrderId &&
        (() => {
          const order = myDeliveries.find(
            (o) => o.orderId === activeMapOrderId,
          )
          if (!order) return null
          const isEnRoute = order.status === 'out-for-delivery'
          const destLat = isEnRoute
            ? order.deliveryLat
            : order.businessLocationLat
          const destLng = isEnRoute
            ? order.deliveryLng
            : order.businessLocationLng
          const label = isEnRoute
            ? order.customerName || t('Customer', 'العميل')
            : order.businessName
          const logoUrl = isEnRoute ? undefined : order.businessLogoUrl

          return (
            <DriverNavigationMap
              driverLat={driverLat}
              driverLng={driverLng}
              destLat={destLat ?? null}
              destLng={destLng ?? null}
              onMinimize={() => setMapState('minimized')}
              onClose={() => setMapState('hidden')}
              destinationLabel={label}
              destinationLogoUrl={logoUrl}
            />
          )
        })()}
    </div>
  )
}

/* ─── Wrapper with Suspense boundary ────────────────────────────────── */

export function DriverOrdersV2() {
  return (
    <Suspense
      fallback={
        <p className="text-slate-400 text-base p-6">Loading\u2026</p>
      }
    >
      <DriverOrdersV2Content />
    </Suspense>
  )
}
