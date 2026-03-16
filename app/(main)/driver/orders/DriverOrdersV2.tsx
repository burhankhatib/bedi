'use client'

import { Suspense, useState, useEffect, useCallback, useRef, useMemo, startTransition } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Store, MapPin, Navigation, Flag, Wallet, Receipt, Truck,
  User, Smartphone, CircleAlert, RefreshCw, ArrowDown, History,
  ChevronDown, Package, Calculator, Phone, Trash2, ShieldCheck, Heart, X,
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
  requiresPersonalShopper?: boolean
  shopperFee?: number
  items?: Array<{ productId?: string; productName?: string; quantity?: number; price?: number; total?: number; notes?: string; addOns?: string; isPicked?: boolean; notPickedReason?: string; imageUrl?: string }>
  customerItemChangeStatus?: 'pending' | 'approved' | 'contact_requested' | 'driver_declined' | null
  customerRequestedItemChanges?: boolean
  customerItemChangeSummary?: Array<{ type?: string; fromName?: string; toName?: string; fromQuantity?: number; toQuantity?: number; note?: string }>
  /** True when business manually assigned and driver has not confirmed yet. */
  needsConfirmation?: boolean
}

type ReplacementProduct = {
  _id: string
  title_en: string
  title_ar: string
  price: number
  currency: string
  imageUrl?: string
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

const isSamsungLike = () =>
  typeof navigator !== 'undefined' && /samsung|android/i.test(navigator.userAgent)
const GEOLOC_TIMEOUT = () => (isSamsungLike() ? 25000 : 10000)

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
    { enableHighAccuracy: true, timeout: GEOLOC_TIMEOUT(), maximumAge: 0 },
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
  const countdownBoxRef = useRef<HTMLDivElement>(null)
  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null)
  const [savingItemsOrderId, setSavingItemsOrderId] = useState<string | null>(null)
  const [editingItemsByOrder, setEditingItemsByOrder] = useState<Record<string, Array<{ productName?: string; quantity?: number; notes?: string; addOns?: string; price?: number; _key?: string; productId?: string; isPicked?: boolean; notPickedReason?: string; imageUrl?: string }>>>({})
  const [replacementProductsByOrder, setReplacementProductsByOrder] = useState<Record<string, Record<number, ReplacementProduct[]>>>({})
  const [replacementSelectionByOrder, setReplacementSelectionByOrder] = useState<Record<string, Record<number, string>>>({})
  const [replacementSearchByOrder, setReplacementSearchByOrder] = useState<Record<string, Record<number, string>>>({})
  const [replacementLoadingByOrder, setReplacementLoadingByOrder] = useState<Record<string, Record<number, boolean>>>({})
  const [additionalProductsByOrder, setAdditionalProductsByOrder] = useState<Record<string, ReplacementProduct[]>>({})
  const [additionalProductSelectionByOrder, setAdditionalProductSelectionByOrder] = useState<Record<string, string>>({})
  const [additionalProductSearchByOrder, setAdditionalProductSearchByOrder] = useState<Record<string, string>>({})
  const [additionalProductLoadingByOrder, setAdditionalProductLoadingByOrder] = useState<Record<string, boolean>>({})
  const [customerApprovedModalDismissed, setCustomerApprovedModalDismissed] = useState<Set<string>>(new Set())
  const [customerEditResponseSending, setCustomerEditResponseSending] = useState<string | null>(null)
  const [expandedDetailsByOrder, setExpandedDetailsByOrder] = useState<Record<string, Set<number>>>({})
  const [addProductFormOpenByOrder, setAddProductFormOpenByOrder] = useState<Record<string, boolean>>({})
  const [pendingPickupManualConfirmOrderId, setPendingPickupManualConfirmOrderId] = useState<string | null>(null)

  const [driverLat, setDriverLat] = useState<number | null>(null)
  const [driverLng, setDriverLng] = useState<number | null>(null)
  const [deliveryNow, setDeliveryNow] = useState(() => Date.now())

  const prevPendingCountRef = useRef(0)
  const declinedOrderIdsRef = useRef<Set<string>>(new Set())
  const acceptedAtRef = useRef<Map<string, number>>(new Map())
  const pickedUpAtRef = useRef<number | null>(null)
  const activeMapOrderIdRef = useRef<string | null>(null)

  const [startY, setStartY] = useState<number | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const MAX_PULL = 120
  const REFRESH_THRESHOLD = 80

  /* ── always-on driver geolocation (for distance calcs + map). Samsung: longer timeout. ────── */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    const timeout = GEOLOC_TIMEOUT()
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDriverLat(pos.coords.latitude)
        setDriverLng(pos.coords.longitude)
      },
      () => {},
      { enableHighAccuracy: true, timeout, maximumAge: 30000 },
    )
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setDriverLat(pos.coords.latitude)
        setDriverLng(pos.coords.longitude)
      },
      () => {},
      { enableHighAccuracy: true, timeout, maximumAge: 5000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  useEffect(() => { activeMapOrderIdRef.current = activeMapOrderId }, [activeMapOrderId])

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

        // Use updater to preserve optimistic pickup state:
        // if the driver just slid "pick up" and the server hasn't
        // propagated yet, keep the local version so the map and
        // Phase C UI don't flicker back to Phase B.
        setMyDeliveries((prev) => {
          const pickedUpTs = pickedUpAtRef.current
          const navId = activeMapOrderIdRef.current
          if (pickedUpTs && now - pickedUpTs < keepWindow && navId) {
            const localOrder = prev.find(
              (lo) => lo.orderId === navId && lo.status === 'out-for-delivery'
            )
            if (localOrder) {
              const idx = mergedMy.findIndex((o) => o.orderId === navId)
              if (idx !== -1 && mergedMy[idx].status !== 'out-for-delivery') {
                mergedMy[idx] = localOrder
              }
            }
          }
          return mergedMy
        })
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

  // The full-screen map stays open until the driver manually minimizes,
  // closes it, or the order completes. No auto-minimize — the driver
  // should be able to keep the map open at all times for navigation.

  /* auto-scroll to countdown box when map minimizes in Phase C */
  const prevMapStateRef = useRef(mapState)
  useEffect(() => {
    const wasMaximized = prevMapStateRef.current === 'maximized'
    prevMapStateRef.current = mapState
    if (wasMaximized && mapState === 'minimized') {
      setTimeout(() => {
        countdownBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    }
  }, [mapState])

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
    if (!isEnRouteToCustomer || activeOrder?.driverArrivedAt) return
    const id = setInterval(() => setDeliveryNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isEnRouteToCustomer, activeOrder?.driverArrivedAt])

  const quoteIndex = useMemo(() => {
    const id = activeOrder?.orderId || ''
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash) % DRIVER_MOTIVATIONAL_QUOTES.length
  }, [activeOrder?.orderId])

  /** True when driver is within 100m of customer (for enabling "Slide to confirm arrival"). */
  const within100mOfCustomer = useMemo(() => {
    if (!isEnRouteToCustomer || activeOrder?.deliveryLat == null || activeOrder?.deliveryLng == null) return false
    if (driverLat == null || driverLng == null) return false
    const distKm = distanceKm(
      { lat: driverLat, lng: driverLng },
      { lat: activeOrder.deliveryLat, lng: activeOrder.deliveryLng },
    )
    return distKm <= 0.1
  }, [isEnRouteToCustomer, activeOrder?.orderId, activeOrder?.deliveryLat, activeOrder?.deliveryLng, driverLat, driverLng])

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

  const confirmManualAssignment = async (orderId: string) => {
    setActionId(orderId)
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/confirm-assignment`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      showToast(
        t('Order confirmed. Head to the business.', 'تم التأكيد. توجّه إلى المتجر.'),
        t('Order confirmed. Head to the business.', 'تم التأكيد. توجّه إلى المتجر.'),
        'success',
      )
      fetchOrders()
    } catch {
      showToast(
        t('Failed to confirm. Try again.', 'فشل التأكيد. حاول مرة أخرى.'),
        t('Failed to confirm. Try again.', 'فشل التأكيد. حاول مرة أخرى.'),
        'error',
      )
    } finally {
      setActionId(null)
    }
  }

  const declineManualAssignment = async (orderId: string) => {
    setActionId(orderId)
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/decline-assignment`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      showToast(
        t('Order declined. It has been sent back to available drivers.', 'تم رفض الطلب. أُعيد إلى السائقين المتاحين.'),
        t('Order declined. It has been sent back to available drivers.', 'تم رفض الطلب. أُعيد إلى السائقين المتاحين.'),
        'success',
      )
      setMyDeliveries((prev) => prev.filter((o) => o.orderId !== orderId))
      fetchOrders()
    } catch {
      showToast(
        t('Failed to decline. Try again.', 'فشل الرفض. حاول مرة أخرى.'),
        t('Failed to decline. Try again.', 'فشل الرفض. حاول مرة أخرى.'),
        'error',
      )
    } finally {
      setActionId(null)
    }
  }

  const decline = async (orderId: string) => {
    const order = pending.find((x) => x.orderId === orderId)
    if (!order) return
    setActionId(orderId)
    try {
      await fetch(`/api/driver/orders/${orderId}/decline`, { method: 'POST' })
      declinedOrderIdsRef.current.add(orderId)
      startTransition(() => {
        setPending((prev) => prev.filter((x) => x.orderId !== orderId))
      })
      showToast(
        t('Order declined. Go to History to undo if needed.', 'تم رفض الطلب. اذهب للسجل لإلغاء الرفض إن لزم.'),
        t('Order declined. Go to History to undo if needed.', 'تم رفض الطلب. اذهب للسجل لإلغاء الرفض إن لزم.'),
        'success',
      )
    } catch {
      showToast(
        t('Failed to decline. Try again.', 'فشل الرفض. حاول مرة أخرى.'),
        t('Failed to decline. Try again.', 'فشل الرفض. حاول مرة أخرى.'),
        'error',
      )
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

  const pickUp = async (orderId: string, manualCustomerChangeConfirm = false): Promise<boolean> => {
    const order = myDeliveries.find((x) => x.orderId === orderId)
    if (!order) return false
    if (order.customerItemChangeStatus === 'pending' && !manualCustomerChangeConfirm) {
      setPendingPickupManualConfirmOrderId(orderId)
      return false
    }
    setActionId(orderId)
    pickedUpAtRef.current = Date.now()
    setMyDeliveries((prev) =>
      prev.map((x) =>
        x.orderId === orderId
          ? { ...x, status: 'out-for-delivery', driverPickedUpAt: new Date().toISOString() }
          : x,
      ),
    )
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/pick-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualCustomerChangeConfirm }),
      })
      if (res.status === 409) {
        const data = await res.json().catch(() => null)
        if (data?.requiresManualCustomerChangeConfirm) {
          setPendingPickupManualConfirmOrderId(orderId)
          setMyDeliveries((prev) =>
            prev.map((x) => (x.orderId === orderId ? order : x)),
          )
          return false
        }
      }
      if (!res.ok) throw new Error('Failed')
      showToast(
        t('Order picked up.', 'تم استلام الطلب.'),
        t('Order picked up.', 'تم استلام الطلب.'),
        'success',
      )
      setPendingPickupManualConfirmOrderId(null)
      pushDriverLocation()
      setActiveMapOrderId(orderId)
      setMapState('maximized')
      // Delayed refetch — give Sanity time to propagate the write before
      // we replace the optimistic state with server data.
      setTimeout(() => fetchOrders(), 3000)
      return true
    } catch {
      setMyDeliveries((prev) =>
        prev.map((x) => (x.orderId === orderId ? order : x)),
      )
      showToast(
        t('Failed to mark as picked up.', 'فشل تسجيل الاستلام.'),
        t('Failed to mark as picked up.', 'فشل تسجيل الاستلام.'),
        'error',
      )
      return false
    } finally {
      setActionId(null)
    }
  }

  const confirmPendingPickupManually = async () => {
    if (!pendingPickupManualConfirmOrderId) return
    await pickUp(pendingPickupManualConfirmOrderId, true)
  }

  const respondToCustomerEdit = async (orderId: string, action: 'approve' | 'decline') => {
    if (customerEditResponseSending) return
    setCustomerEditResponseSending(orderId)
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/customer-edit-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error('Failed')
      showToast(
        action === 'approve'
          ? t('Customer changes approved.', 'تمت الموافقة على تعديلات العميل.')
          : t('Customer changes declined.', 'تم رفض تعديلات العميل.'),
        action === 'approve'
          ? t('Customer changes approved.', 'تمت الموافقة على تعديلات العميل.')
          : t('Customer changes declined.', 'تم رفض تعديلات العميل.'),
        action === 'approve' ? 'success' : 'info'
      )
      fetchOrders()
    } catch {
      showToast(
        t('Could not submit response. Try again.', 'تعذر إرسال الرد. حاول مرة أخرى.'),
        t('Could not submit response. Try again.', 'تعذر إرسال الرد. حاول مرة أخرى.'),
        'error'
      )
    } finally {
      setCustomerEditResponseSending(null)
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
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

  const loadReplacementProducts = async (
    orderId: string,
    itemIndex: number,
    sourceProductId?: string,
    query?: string
  ) => {
    if (!sourceProductId) return
    const search = (query || '').trim()
    setReplacementLoadingByOrder((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        [itemIndex]: true,
      },
    }))
    try {
      const params = new URLSearchParams({
        sourceProductId,
        ...(search ? { q: search } : {}),
      })
      const res = await fetch(`/api/driver/orders/${orderId}/replacement-products?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setReplacementProductsByOrder((prev) => ({
        ...prev,
        [orderId]: {
          ...(prev[orderId] || {}),
          [itemIndex]: Array.isArray(data.products) ? data.products : [],
        },
      }))
    } catch {
      // keep silent; details editor still supports remove/qty edits
    } finally {
      setReplacementLoadingByOrder((prev) => ({
        ...prev,
        [orderId]: {
          ...(prev[orderId] || {}),
          [itemIndex]: false,
        },
      }))
    }
  }

  const loadAdditionalProducts = async (orderId: string, query?: string) => {
    const search = (query || '').trim()
    setAdditionalProductLoadingByOrder((prev) => ({ ...prev, [orderId]: true }))
    try {
      const params = new URLSearchParams({
        ...(search ? { q: search } : {}),
      })
      const res = await fetch(`/api/driver/orders/${orderId}/replacement-products?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setAdditionalProductsByOrder((prev) => ({
        ...prev,
        [orderId]: Array.isArray(data.products) ? data.products : [],
      }))
    } catch {
      // keep editor usable even if additional products fetch fails
    } finally {
      setAdditionalProductLoadingByOrder((prev) => ({ ...prev, [orderId]: false }))
    }
  }

  const openOrderDetails = (order: DriverOrder) => {
    const isSame = detailsOrderId === order.orderId
    if (isSame) {
      setDetailsOrderId(null)
      return
    }
    setDetailsOrderId(order.orderId)
    setEditingItemsByOrder((prev) => ({
      ...prev,
      [order.orderId]: (order.items || []).map((item, idx) => ({
        _key: `driver-${order.orderId}-${idx}`,
        productId: item.productId,
        productName: item.productName || '',
        quantity: Math.max(1, Number(item.quantity) || 1),
        notes: item.notes || '',
        addOns: item.addOns || '',
        isPicked: item.isPicked !== false,
        notPickedReason: item.notPickedReason || '',
        price: Math.max(
          0,
          typeof item.price === 'number'
            ? item.price
            : (Number(item.total) || 0) / Math.max(1, Number(item.quantity) || 1)
        ),
        imageUrl: (item as { imageUrl?: string }).imageUrl || '',
      })),
    }))
    void loadAdditionalProducts(order.orderId, additionalProductSearchByOrder[order.orderId] || '')
  }

  const togglePickedItem = (orderId: string, index: number) => {
    const items = editingItemsByOrder[orderId] || []
    const item = items[index]
    const nextPicked = item?.isPicked === false
    setEditingItemsByOrder((prev) => ({
      ...prev,
      [orderId]: (prev[orderId] || []).map((it, idx) => {
        if (idx !== index) return it
        return {
          ...it,
          isPicked: nextPicked,
          notPickedReason: nextPicked ? '' : (it.notPickedReason || t('Unavailable at store', 'غير متوفر في المتجر')),
        }
      }),
    }))
    if (!nextPicked && item?.productId) {
      void loadReplacementProducts(orderId, index, item.productId, '')
    }
  }

  const removeDriverAddedItem = (orderId: string, index: number) => {
    const items = editingItemsByOrder[orderId] || []
    const item = items[index]
    if (!item || !String(item._key || '').startsWith('driver-added-')) return
    setEditingItemsByOrder((prev) => ({
      ...prev,
      [orderId]: (prev[orderId] || []).filter((_, idx) => idx !== index),
    }))
  }

  const updateEditingItemQuantity = (orderId: string, index: number, delta: number) => {
    setEditingItemsByOrder((prev) => ({
      ...prev,
      [orderId]: (prev[orderId] || []).map((item, idx) => {
        if (idx !== index) return item
        const nextQty = Math.max(1, (item.quantity || 1) + delta)
        return { ...item, quantity: nextQty }
      }),
    }))
  }

  const replaceEditingItem = (orderId: string, index: number) => {
    const productId = replacementSelectionByOrder[orderId]?.[index]
    if (!productId) return
    const product = replacementProductsByOrder[orderId]?.[index]?.find((p) => p._id === productId)
    if (!product) return
    setEditingItemsByOrder((prev) => ({
      ...prev,
      [orderId]: (prev[orderId] || []).map((item, idx) => {
        if (idx !== index) return item
        return {
          ...item,
          productId: product._id,
          productName: lang === 'ar' ? product.title_ar : product.title_en,
          price: product.price,
          isPicked: true,
          notPickedReason: '',
          notes: item.notes || '',
          imageUrl: product.imageUrl || '',
        }
      }),
    }))
  }

  const addSelectedProductToOrder = (orderId: string) => {
    const productId = additionalProductSelectionByOrder[orderId]
    if (!productId) return
    const product = (additionalProductsByOrder[orderId] || []).find((p) => p._id === productId)
    if (!product) return
    setEditingItemsByOrder((prev) => ({
      ...prev,
      [orderId]: [
        ...(prev[orderId] || []),
        {
          _key: `driver-added-${Date.now()}`,
          productId: product._id,
          productName: lang === 'ar' ? product.title_ar : product.title_en,
          quantity: 1,
          notes: '',
          addOns: '',
          price: product.price,
          isPicked: true,
          notPickedReason: '',
          imageUrl: product.imageUrl || '',
        },
      ],
    }))
    setAdditionalProductSelectionByOrder((prev) => ({ ...prev, [orderId]: '' }))
    setAdditionalProductSearchByOrder((prev) => ({ ...prev, [orderId]: '' }))
    setAdditionalProductsByOrder((prev) => ({ ...prev, [orderId]: [] }))
    setAddProductFormOpenByOrder((prev) => ({ ...prev, [orderId]: false }))
  }

  const saveDriverItemChanges = async (order: DriverOrder) => {
    const edited = editingItemsByOrder[order.orderId] || []
    if (!edited.length) {
      showToast(t('Order must contain at least one item.', 'يجب أن يحتوي الطلب على صنف واحد على الأقل.'), t('Order must contain at least one item.', 'يجب أن يحتوي الطلب على صنف واحد على الأقل.'), 'error')
      return
    }

    const original = order.items || []
    const changeSummary: Array<{ type: 'removed' | 'replaced' | 'edited' | 'not_picked'; fromName?: string; toName?: string; fromQuantity?: number; toQuantity?: number; note?: string }> = []
    const maxLen = Math.max(original.length, edited.length)
    for (let i = 0; i < maxLen; i++) {
      const from = original[i]
      const to = edited[i]
      if (from && !to) {
        changeSummary.push({ type: 'removed', fromName: from.productName, fromQuantity: from.quantity })
      } else if (!from && to) {
        changeSummary.push({ type: 'edited', toName: to.productName, toQuantity: to.quantity, note: t('Added item by driver', 'تمت إضافة صنف بواسطة السائق') })
      } else if (from && to) {
        const becameNotPicked = from.isPicked !== false && to.isPicked === false
        if (becameNotPicked) {
          changeSummary.push({
            type: 'not_picked',
            fromName: from.productName,
            fromQuantity: from.quantity,
            note: to.notPickedReason || t('Not available at store', 'غير متوفر في المتجر'),
          })
          continue
        }
        const nameChanged = (from.productName || '').trim() !== (to.productName || '').trim()
        const qtyChanged = (from.quantity || 1) !== (to.quantity || 1)
        if (nameChanged || qtyChanged) {
          changeSummary.push({
            type: nameChanged ? 'replaced' : 'edited',
            fromName: from.productName,
            toName: to.productName,
            fromQuantity: from.quantity,
            toQuantity: to.quantity,
          })
        }
      }
    }

    setSavingItemsOrderId(order.orderId)
    try {
      const res = await fetch(`/api/driver/orders/${order.orderId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: edited.map((item) => ({
            _key: item._key,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: Math.max(0, Number(item.price) || 0),
            total: Math.max(0, Number(item.price) || 0) * Math.max(1, Number(item.quantity) || 1),
            isPicked: item.isPicked !== false,
            notPickedReason: item.notPickedReason || '',
            notes: item.notes || '',
            addOns: item.addOns || '',
          })),
          changeSummary,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      showToast(
        t('Items updated. Customer was notified to confirm changes.', 'تم تحديث الأصناف. تم إشعار العميل لتأكيد التغييرات.'),
        t('Items updated. Customer was notified to confirm changes.', 'تم تحديث الأصناف. تم إشعار العميل لتأكيد التغييرات.'),
        'success'
      )
      setDetailsOrderId(null)
      fetchOrders()
    } catch {
      showToast(
        t(`Could not save changes.`, `تعذر حفظ التغييرات.`),
        t(`Could not save changes.`, `تعذر حفظ التغييرات.`),
        'error'
      )
    } finally {
      setSavingItemsOrderId(null)
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

  const toggleExpandedDetails = (orderId: string, idx: number) => {
    setExpandedDetailsByOrder((prev) => {
      const set = new Set(prev[orderId] || [])
      if (set.has(idx)) set.delete(idx)
      else set.add(idx)
      return { ...prev, [orderId]: set }
    })
  }

  const renderOrderDetailsPanel = (order: DriverOrder) => {
    if (detailsOrderId !== order.orderId) return null
    const editedItems = editingItemsByOrder[order.orderId] || []
    const pickedCount = editedItems.filter((item) => item.isPicked !== false).length
    const notPickedCount = editedItems.length - pickedCount
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-slate-900/70 p-4 mb-4 space-y-4">
        <p className="text-sm text-amber-200 font-medium">
          {t('Mark picked/not picked. Uncheck unavailable items to see similar alternatives.', 'حدّد ملتقط/غير ملتقط. ألغِ تحديد الصنف غير المتوفر لرؤية بدائل مشابهة.')}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-sm font-bold text-emerald-300">
            ✅ {t('Picked', 'تم التقاطه')}: {pickedCount}
          </span>
          <span className="rounded-full bg-rose-500/20 border border-rose-500/40 px-3 py-1.5 text-sm font-bold text-rose-300">
            ❌ {t('Not picked', 'غير ملتقط')}: {notPickedCount}
          </span>
        </div>
        {editedItems.map((item, idx) => {
          const picked = item.isPicked !== false
          const isDriverAdded = String(item._key || '').startsWith('driver-added-')
          const replacementOptions = replacementProductsByOrder[order.orderId]?.[idx] || []
          const replacementQuery = replacementSearchByOrder[order.orderId]?.[idx] || ''
          const replacementLoading = replacementLoadingByOrder[order.orderId]?.[idx] === true
          const hasDetails = !!(item.notes || item.addOns || (!picked && item.notPickedReason))
          const isDetailsExpanded = (expandedDetailsByOrder[order.orderId] || new Set()).has(idx)
          return (
            <div key={`${order.orderId}-item-${idx}`} className="rounded-2xl border border-slate-600/60 bg-slate-800/80 overflow-hidden relative">
              {isDriverAdded && (
                <button
                  type="button"
                  onClick={() => removeDriverAddedItem(order.orderId, idx)}
                  className="absolute top-2 right-2 rtl:right-auto rtl:left-2 z-10 w-10 h-10 rounded-full bg-rose-500/80 hover:bg-rose-500 text-white flex items-center justify-center border-2 border-rose-400/50 shadow-lg"
                  aria-label={t('Remove', 'حذف')}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <div className="flex gap-4 p-4">
                {/* Product image — M3 72dp */}
                <div className="shrink-0 w-[72px] h-[72px] rounded-2xl overflow-hidden bg-slate-700/50 border border-slate-600/50">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      <Package className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 flex flex-col gap-2">
                  <p className={`text-base font-bold leading-snug ${picked ? 'text-slate-100' : 'text-rose-300 line-through'}`}>
                    {(item.productName || t('Item', 'صنف'))}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-emerald-400">
                      {(item.price ?? 0) * (item.quantity ?? 1)} {fmtCurrency('ILS')}
                    </span>
                    <span className="text-slate-500 text-sm">× {item.quantity ?? 1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => togglePickedItem(order.orderId, idx)}
                      className={`min-w-[44px] min-h-[44px] rounded-xl border-2 flex items-center justify-center text-sm font-bold transition-all ${picked ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-rose-500/20 border-rose-500/50 text-rose-400'}`}
                      aria-label={t('Toggle picked', 'تبديل الالتقاط')}
                    >
                      {picked ? '✓' : '✗'}
                    </button>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => updateEditingItemQuantity(order.orderId, idx, -1)} className="min-w-[44px] min-h-[44px] rounded-xl border border-slate-600 bg-slate-700/50 text-white font-bold text-lg">−</button>
                      <span className="min-w-[2.5rem] text-center text-base font-bold">{item.quantity ?? 1}</span>
                      <button type="button" onClick={() => updateEditingItemQuantity(order.orderId, idx, 1)} className="min-w-[44px] min-h-[44px] rounded-xl border border-slate-600 bg-slate-700/50 text-white font-bold text-lg">+</button>
                    </div>
                  </div>
                  {hasDetails && (
                    <button
                      type="button"
                      onClick={() => toggleExpandedDetails(order.orderId, idx)}
                      className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm font-medium"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${isDetailsExpanded ? 'rotate-180' : ''}`} />
                      {isDetailsExpanded ? t('Hide details', 'إخفاء التفاصيل') : t('Show details', 'عرض التفاصيل')}
                    </button>
                  )}
                  {isDetailsExpanded && hasDetails && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-600/50">
                      {item.notes && <p className="text-sm text-slate-400">📝 {item.notes}</p>}
                      {item.addOns && <p className="text-sm text-slate-500">+ {item.addOns}</p>}
                      {!picked && item.notPickedReason && <p className="text-sm text-rose-400/90">{item.notPickedReason}</p>}
                    </div>
                  )}
                </div>
              </div>
              {/* Replacement section — only when unchecked */}
              {!picked && (
                <div className="border-t border-slate-600/50 p-4 bg-slate-900/50 space-y-4">
                  <p className="text-sm font-bold text-indigo-200">
                    {t('Similar products from same category', 'أصناف مشابهة من نفس الفئة')}
                  </p>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <input
                        value={replacementQuery}
                        onChange={(e) => setReplacementSearchByOrder((prev) => ({ ...prev, [order.orderId]: { ...(prev[order.orderId] || {}), [idx]: e.target.value } }))}
                        placeholder={t('Search (e.g. milk)', 'ابحث (مثال: حليب)')}
                        className="flex-1 min-h-[48px] rounded-2xl border-2 border-slate-600 bg-slate-900 px-4 text-base text-slate-100 placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => void loadReplacementProducts(order.orderId, idx, item.productId || '', replacementQuery)}
                        disabled={!item.productId || replacementLoading}
                        className="min-h-[48px] min-w-[120px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base disabled:opacity-50"
                      >
                        {replacementLoading ? t('Searching...', 'جاري...') : t('Search', 'بحث')}
                      </button>
                    </div>
                    {replacementOptions.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {replacementOptions.map((p) => {
                          const selected = replacementSelectionByOrder[order.orderId]?.[idx] === p._id
                          return (
                            <button
                              key={p._id}
                              type="button"
                              onClick={() => setReplacementSelectionByOrder((prev) => ({ ...prev, [order.orderId]: { ...(prev[order.orderId] || {}), [idx]: p._id } }))}
                              className={`w-full flex items-center gap-4 p-3 rounded-2xl border-2 text-left transition-colors ${selected ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-600 bg-slate-800/80 hover:bg-slate-700/80'}`}
                            >
                              <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-slate-700">
                                {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-500"><Package className="w-6 h-6" /></div>}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-100 truncate">{lang === 'ar' ? p.title_ar : p.title_en}</p>
                                <p className="text-emerald-400 font-bold">{p.price.toFixed(2)} {fmtCurrency(p.currency)}</p>
                              </div>
                              {selected && <span className="text-emerald-400 font-bold shrink-0">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-slate-400 text-sm">
                        {replacementLoading ? t('Searching...', 'جاري البحث...') : t('No similar products found. Search above.', 'لا توجد أصناف مشابهة. ابحث أعلاه.')}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => replaceEditingItem(order.orderId, idx)}
                      disabled={!replacementSelectionByOrder[order.orderId]?.[idx]}
                      className="w-full min-h-[48px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base disabled:opacity-50"
                    >
                      🔁 {t('Use selected alternative', 'استخدم البديل المختار')}
                    </button>
                  </div>
                  <input
                    value={item.notPickedReason || ''}
                    onChange={(e) => setEditingItemsByOrder((prev) => ({ ...prev, [order.orderId]: (prev[order.orderId] || []).map((row, rowIdx) => rowIdx === idx ? { ...row, notPickedReason: e.target.value } : row) }))}
                    placeholder={t('Reason (optional)', 'السبب (اختياري)')}
                    className="w-full min-h-[44px] rounded-2xl border-2 border-slate-600 bg-slate-900 px-4 text-base text-slate-200 placeholder:text-slate-500"
                  />
                </div>
              )}
            </div>
          )
        })}
        {!addProductFormOpenByOrder[order.orderId] ? (
          <button
            type="button"
            onClick={() => setAddProductFormOpenByOrder((prev) => ({ ...prev, [order.orderId]: true }))}
            className="w-full min-h-[52px] rounded-2xl border-2 border-dashed border-emerald-500/50 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-300 font-bold text-base flex items-center justify-center gap-2 transition-colors"
          >
            <Package className="w-5 h-5 shrink-0" />
            {t('Add a product', 'إضافة صنف')}
          </button>
        ) : (
          <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-950/20 p-4 space-y-4 relative">
            <button
              type="button"
              onClick={() => setAddProductFormOpenByOrder((prev) => ({ ...prev, [order.orderId]: false }))}
              className="absolute top-3 end-3 rtl:end-auto rtl:start-3 w-8 h-8 rounded-full bg-slate-700/80 hover:bg-slate-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              aria-label={t('Close', 'إغلاق')}
            >
              <X className="w-4 h-4" />
            </button>
            <p className="text-base font-bold text-emerald-200 pe-10 rtl:pe-0 rtl:ps-10">
              {t('Add missing item', 'إضافة صنف ناقص')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={additionalProductSearchByOrder[order.orderId] || ''}
                onChange={(e) => setAdditionalProductSearchByOrder((prev) => ({ ...prev, [order.orderId]: e.target.value }))}
                placeholder={t('Search business products', 'ابحث في أصناف المتجر')}
                className="flex-1 min-h-[48px] rounded-2xl border-2 border-slate-600 bg-slate-900 px-4 text-base text-slate-100 placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => void loadAdditionalProducts(order.orderId, additionalProductSearchByOrder[order.orderId] || '')}
                disabled={additionalProductLoadingByOrder[order.orderId] === true}
                className="min-h-[48px] min-w-[120px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base disabled:opacity-50"
              >
                {additionalProductLoadingByOrder[order.orderId] ? t('Searching...', 'جاري...') : t('Search', 'بحث')}
              </button>
            </div>
            {(additionalProductsByOrder[order.orderId] || []).length > 0 ? (
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {(additionalProductsByOrder[order.orderId] || []).map((p) => {
                  const selected = additionalProductSelectionByOrder[order.orderId] === p._id
                  return (
                    <button
                      key={`add-${p._id}`}
                      type="button"
                      onClick={() => setAdditionalProductSelectionByOrder((prev) => ({ ...prev, [order.orderId]: p._id }))}
                      className={`w-full flex items-center gap-4 p-3 rounded-2xl border-2 text-left transition-colors ${selected ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-600 bg-slate-800/80 hover:bg-slate-700/80'}`}
                    >
                      <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-slate-700">
                        {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-500"><Package className="w-6 h-6" /></div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-100 truncate">{lang === 'ar' ? p.title_ar : p.title_en}</p>
                        <p className="text-emerald-400 font-bold">{p.price.toFixed(2)} {fmtCurrency(p.currency)}</p>
                      </div>
                      {selected && <span className="text-emerald-400 font-bold shrink-0">✓</span>}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">
                {additionalProductLoadingByOrder[order.orderId] ? t('Searching...', 'جاري البحث...') : t('Search above to add.', 'ابحث أعلاه للإضافة.')}
              </p>
            )}
            <button
              type="button"
              onClick={() => addSelectedProductToOrder(order.orderId)}
              disabled={!additionalProductSelectionByOrder[order.orderId]}
              className="w-full min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base disabled:opacity-50"
            >
              ➕ {t('Add selected item', 'إضافة الصنف المحدد')}
            </button>
            <p className="text-xs text-slate-400">
              {t('Customer must approve changes.', 'العميل يجب أن يوافق على التغييرات.')}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => saveDriverItemChanges(order)}
          disabled={savingItemsOrderId === order.orderId}
          className="w-full min-h-[52px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base disabled:opacity-60"
        >
          {savingItemsOrderId === order.orderId
            ? t('Saving...', 'جارٍ الحفظ...')
            : t('Send changes to customer for confirmation', 'إرسال التغييرات للعميل للتأكيد')}
        </button>
      </div>
    )
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
      ) : hasActiveDelivery && activeOrder?.needsConfirmation ? (
        /* ══════════════════════════════════════════════════ */
        /*  MANUAL ASSIGNMENT CONFIRMATION MODAL             */
        /* ══════════════════════════════════════════════════ */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-3xl border-2 border-amber-600/60 bg-amber-950/30 p-5 sm:p-6 shadow-xl"
        >
          <div className="text-center mb-6">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/30 border-2 border-amber-500/50 mb-4">
              <Package className="h-8 w-8 text-amber-300" />
            </div>
            <h2 className="text-xl font-black text-white mb-2">
              {t('Order assigned to you', 'تم تعيين طلب لك')}
            </h2>
            <p className="text-slate-300 text-sm mb-1">
              {t('The business assigned you to deliver this order. Confirm to accept or decline.', 'المتجر عيّنك لتوصيل هذا الطلب. أكّد لقبوله أو ارفض.')}
            </p>
            <p className="font-mono text-lg font-bold text-emerald-400">
              #{formatDriverOrderNumber(activeOrder.orderNumber)}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {activeOrder.businessName} · {activeOrder.totalAmount.toFixed(2)} {activeOrder.currency}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => declineManualAssignment(activeOrder.orderId)}
              disabled={actionId === activeOrder.orderId}
              className="flex-1 rounded-2xl border-2 border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-4 disabled:opacity-60 transition-colors"
            >
              {actionId === activeOrder.orderId ? t('Wait...', 'انتظر...') : t('Decline', 'رفض')}
            </button>
            <button
              type="button"
              onClick={() => confirmManualAssignment(activeOrder.orderId)}
              disabled={actionId === activeOrder.orderId}
              className="flex-1 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-4 disabled:opacity-60 transition-colors"
            >
              {actionId === activeOrder.orderId ? t('Wait...', 'انتظر...') : t('Confirm', 'تأكيد')}
            </button>
          </div>
        </motion.div>
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
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-white font-bold py-3.5 text-sm min-h-[48px] active:scale-[0.97] transition-all"
                    >
                      <Navigation className="w-4 h-4 shrink-0 text-slate-400" />
                      Maps
                    </a>
                    <a
                      href={urls.waze}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-white font-bold py-3.5 text-sm min-h-[48px] active:scale-[0.97] transition-all"
                    >
                      <Navigation className="w-4 h-4 shrink-0 text-slate-400" />
                      Waze
                    </a>
                    <button
                      onClick={() => {
                        setActiveMapOrderId(activeOrder.orderId)
                        setMapState('maximized')
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 text-sm min-h-[48px] active:scale-[0.97] transition-all"
                    >
                      <MapPin className="w-4 h-4 shrink-0" />
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

            {/* Customer updated the order — driver must Approve or Decline */}
            {activeOrder.customerRequestedItemChanges && activeOrder.customerItemChangeStatus === 'pending' && (
              <div className="rounded-2xl border-2 border-indigo-500/40 bg-indigo-950/30 p-4 mb-4">
                <p className="text-indigo-200 font-bold text-base mb-2">
                  {t('Customer updated the order', 'العميل حدّث الطلب')}
                </p>
                <p className="text-indigo-300/90 text-sm mb-3">
                  {t('Review the changes below and approve or decline.', 'راجع التغييرات أدناه ووافق أو ارفض.')}
                </p>
                {(activeOrder.customerItemChangeSummary ?? []).length > 0 && (
                  <ul className="space-y-1.5 mb-4 text-sm text-slate-200">
                    {(activeOrder.customerItemChangeSummary ?? []).map((ch, idx) => (
                      <li key={idx} className="flex flex-wrap gap-x-2">
                        <span className="font-semibold text-amber-300">
                          {ch.type === 'removed' && t('Removed', 'تمت الإزالة')}
                          {ch.type === 'replaced' && t('Replaced', 'تم الاستبدال')}
                          {ch.type === 'edited' && t('Updated', 'تم التحديث')}
                          {ch.type === 'not_picked' && t('Not picked', 'لم يتم التقاطه')}
                          {': '}
                        </span>
                        {ch.fromName && <span>{ch.fromName}</span>}
                        {ch.toName && <span>→ {ch.toName}</span>}
                        {ch.note && <span className="text-slate-400">({ch.note})</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => respondToCustomerEdit(activeOrder.orderId, 'approve')}
                    disabled={customerEditResponseSending === activeOrder.orderId}
                    className="flex-1 min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base disabled:opacity-60"
                  >
                    {customerEditResponseSending === activeOrder.orderId ? t('Sending...', 'جاري...') : t('Approve', 'موافق')}
                  </button>
                  <button
                    type="button"
                    onClick={() => respondToCustomerEdit(activeOrder.orderId, 'decline')}
                    disabled={customerEditResponseSending === activeOrder.orderId}
                    className="flex-1 min-h-[48px] rounded-2xl border-2 border-slate-500 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-base disabled:opacity-60"
                  >
                    {t('Decline', 'رفض')}
                  </button>
                </div>
              </div>
            )}

            {activeOrder.customerItemChangeStatus && activeOrder.customerItemChangeStatus !== 'approved' && !activeOrder.customerRequestedItemChanges && (
              <div className={`rounded-2xl border p-3 mb-4 text-sm ${
                activeOrder.customerItemChangeStatus === 'pending'
                  ? 'border-amber-500/40 bg-amber-950/20 text-amber-200'
                  : 'border-sky-500/40 bg-sky-950/20 text-sky-200'
              }`}>
                {activeOrder.customerItemChangeStatus === 'pending' && t('Waiting for customer confirmation on latest item changes.', 'بانتظار تأكيد العميل على آخر تغييرات الأصناف.')}
                {activeOrder.customerItemChangeStatus === 'contact_requested' && t('Customer requested contact for alternatives.', 'العميل طلب التواصل بخصوص البدائل.')}
                {activeOrder.customerItemChangeStatus === 'driver_declined' && t('You declined the customer\'s edit.', 'رفضت تعديلات العميل.')}
              </div>
            )}
            {activeOrder.customerItemChangeStatus === 'approved' && !customerApprovedModalDismissed.has(activeOrder.orderId) && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
                <div className="rounded-3xl border-2 border-emerald-500/50 bg-slate-900 p-6 max-w-md w-full shadow-2xl text-center">
                  <div className="text-4xl mb-4">✅</div>
                  <h3 className="text-xl font-bold text-emerald-400 mb-2">
                    {t('Customer approved the changes', 'وافق العميل على التغييرات')}
                  </h3>
                  <p className="text-slate-300 text-sm mb-6">
                    {t('The customer has confirmed the item updates. You can proceed with the delivery.', 'أكّد العميل تحديثات الأصناف. يمكنك متابعة التوصيل.')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCustomerApprovedModalDismissed((prev) => new Set(prev).add(activeOrder.orderId))}
                    className="w-full min-h-[52px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base"
                  >
                    {t('Okay', 'موافق')}
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
                  {activeOrder.requiresPersonalShopper && (
                    <div className="mt-3">
                      <span className="inline-flex items-center gap-1.5 text-amber-200 bg-amber-600/40 border border-amber-500/50 font-bold text-sm px-4 py-2 rounded-xl">
                        🛒 {t('Manual collection order', 'طلب تجميع يدوي')}
                      </span>
                    </div>
                  )}
                </div>

                {(activeOrder.items?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => openOrderDetails(activeOrder)}
                    className={`w-full mb-4 rounded-2xl font-black py-3.5 px-4 text-sm min-h-[52px] shadow-md flex items-center justify-center gap-2 ${
                      detailsOrderId === activeOrder.orderId
                        ? 'bg-amber-400 text-slate-950 border-2 border-amber-300'
                        : 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/20'
                    }`}
                  >
                    <Receipt className="h-5 w-5 shrink-0" />
                    {detailsOrderId === activeOrder.orderId
                      ? t('Hide order details', 'إخفاء تفاصيل الطلب')
                      : t('Order Details', 'تفاصيل الطلب')}
                    {activeOrder.requiresPersonalShopper && (
                      <span className="text-slate-700/80 text-xs font-semibold">
                        ({t('Personal Shopper', 'متسوق شخصي')})
                      </span>
                    )}
                  </button>
                )}
                {renderOrderDetailsPanel(activeOrder)}

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

                {/* Financial summary: Pay to Business, Delivery Fee, Save Time fee, Total */}
                <div className="rounded-3xl border border-slate-700/60 bg-slate-800/30 p-4 mb-4 space-y-3">
                  <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-amber-200/80 text-sm font-medium">
                        {t('You need to pay', 'المبلغ المطلوب دفعه')}
                      </p>
                      <p className="font-black text-amber-400 text-lg">
                        {activeOrder.amountToPayTenant.toFixed(2)}{' '}
                        {fmtCurrency(activeOrder.currency)}{' '}
                        <span className="text-amber-200/60 text-base font-medium mx-1">
                          {t('to', 'إلى')}
                        </span>{' '}
                        {activeOrder.businessName}
                      </p>
                    </div>
                  </div>
                  {(activeOrder.requiresPersonalShopper || (activeOrder.shopperFee ?? 0) > 0) && (
                    <div className="rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 p-3.5 flex items-center justify-between">
                      <span className="text-fuchsia-200/85 text-xs font-semibold">🛍️ {t('Save Time fee', 'رسوم توفير الوقت')}</span>
                      <span className="font-black text-fuchsia-300 text-lg">
                        {(activeOrder.shopperFee ?? 0) > 0 ? `${(activeOrder.shopperFee ?? 0).toFixed(2)} ${fmtCurrency(activeOrder.currency)}` : t('FREE', 'مجاناً')}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-sky-500/10 border border-sky-500/20 p-3.5 flex flex-col gap-1">
                      <span className="text-sky-200/80 text-xs font-semibold flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5 text-sky-400" />
                        {t('Delivery fee', 'سعر التوصيل')}
                      </span>
                      <span className="font-black text-sky-400 text-lg">
                        {activeOrder.deliveryFee.toFixed(2)} {fmtCurrency(activeOrder.currency)}
                      </span>
                    </div>
                    <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 flex flex-col gap-1">
                      <span className="text-emerald-200/80 text-xs font-semibold flex items-center gap-1.5">
                        <Receipt className="h-3.5 w-3.5 text-emerald-400" />
                        {t('Total from', 'المجموع من')} {activeOrder.customerName?.trim().split(/\s+/)[0] || t('client', 'العميل')}
                      </span>
                      <span className="font-black text-emerald-400 text-lg">
                        {activeOrder.totalAmount.toFixed(2)} {fmtCurrency(activeOrder.currency)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Business contact (collapsible) */}
                <div className="rounded-3xl bg-slate-800/40 border border-slate-700/50 overflow-hidden mb-4">
                  <div className="flex items-center gap-2 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setShowBizContact((p) => !p)}
                      className="flex-1 flex items-center justify-between min-w-0 focus:outline-none"
                    >
                      <span className="flex items-center gap-2 text-sm font-bold text-slate-300 truncate">
                        <Store className="h-4 w-4 text-amber-400 shrink-0" />
                        {activeOrder.businessName}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-slate-500 shrink-0 transition-transform duration-200 ${showBizContact ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
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

                <AnimatePresence>
                  {pendingPickupManualConfirmOrderId === activeOrder.orderId && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
                      onClick={() => setPendingPickupManualConfirmOrderId(null)}
                    >
                      <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 26 }}
                        className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <h3 className="text-white text-base font-black mb-2">
                          {t('Confirm customer agreement', 'تأكيد موافقة العميل')}
                        </h3>
                        <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                          {t(
                            'Customer has not confirmed item changes in-app yet. Confirm only if you already agreed with the customer by phone.',
                            'العميل لم يؤكد تغييرات الأصناف داخل التطبيق بعد. أكّد فقط إذا تم الاتفاق مع العميل عبر الهاتف.'
                          )}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setPendingPickupManualConfirmOrderId(null)}
                            className="flex-1 rounded-xl border border-slate-600 bg-slate-800 text-slate-100 font-bold py-2.5"
                          >
                            {t('Cancel', 'إلغاء')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void confirmPendingPickupManually()}
                            disabled={actionId === activeOrder.orderId}
                            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 disabled:opacity-60"
                          >
                            {actionId === activeOrder.orderId
                              ? t('Confirming...', 'جارٍ التأكيد...')
                              : t('Yes, customer agreed', 'نعم، العميل موافق')}
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

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
                {/* === COUNTDOWN + TOTAL + TIP — unified hero box === */}
                <div ref={countdownBoxRef}>
                {(() => {
                  const tipActive = activeOrder.tipIncludedInTotal && (activeOrder.tipAmount ?? 0) > 0 && !activeOrder.tipRemovedByDriver
                  const tipPending = activeOrder.tipSentToDriver && (activeOrder.tipAmount ?? 0) > 0 && !activeOrder.tipIncludedInTotal && !activeOrder.tipRemovedByDriver
                  const collectTotal = tipActive
                    ? activeOrder.totalAmount + (activeOrder.tipAmount ?? 0)
                    : activeOrder.totalAmount

                  const hasCountdown = activeOrder.estimatedDeliveryMinutes && activeOrder.driverPickedUpAt
                  let cdMinutes = 0, cdSeconds = 0, isOverdue = false
                  if (hasCountdown) {
                    const pickupMs = new Date(activeOrder.driverPickedUpAt!).getTime()
                    const targetMs = pickupMs + activeOrder.estimatedDeliveryMinutes! * 60 * 1000
                    const remainMs = targetMs - deliveryNow
                    isOverdue = remainMs <= 0
                    cdMinutes = isOverdue ? 0 : Math.floor(remainMs / 60000)
                    cdSeconds = isOverdue ? 0 : Math.floor((remainMs % 60000) / 1000)
                  }

                  return (
                    <div className="rounded-3xl bg-gradient-to-b from-slate-800/80 to-slate-900/80 border border-slate-700/60 overflow-hidden mb-4">
                      {/* — Section 1: Countdown — */}
                      {activeOrder.driverArrivedAt ? (
                        <div className="px-5 py-5 text-center border-b border-slate-700/40">
                          <div className="inline-flex items-center gap-2 bg-emerald-500/15 rounded-full px-4 py-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-emerald-400 font-black text-base">
                              {t('You have arrived', 'لقد وصلت')}
                            </span>
                          </div>
                          <p className="text-slate-400 text-xs mt-2">
                            {t('Hand over the order and complete the delivery.', 'سلّم الطلب وأكمل التوصيل.')}
                          </p>
                          {activeOrder.driverPickedUpAt && (() => {
                            const pickupMs = new Date(activeOrder.driverPickedUpAt).getTime()
                            const arrivedMs = new Date(activeOrder.driverArrivedAt!).getTime()
                            const deliveryMinutes = Math.max(1, Math.round((arrivedMs - pickupMs) / 60000))
                            const estimatedMins = activeOrder.estimatedDeliveryMinutes ?? Infinity
                            const onTime = deliveryMinutes <= estimatedMins
                            return (
                              <p className={`text-sm font-bold mt-3 ${onTime ? 'text-emerald-400' : 'text-red-400'}`}>
                                {t('Delivery time', 'وقت التوصيل')}: {deliveryMinutes} {t('min', 'دقيقة')}
                              </p>
                            )
                          })()}
                        </div>
                      ) : hasCountdown ? (
                        <div className="px-5 py-5 text-center border-b border-slate-700/40">
                          {isOverdue ? (
                            <div className="flex items-center justify-center gap-2">
                              <motion.div
                                animate={{ scale: [1, 1.15, 1] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="text-amber-400 font-black text-lg"
                              >
                                {t('Time\'s up — deliver now!', 'انتهى الوقت — وصّل الآن!')}
                              </motion.div>
                            </div>
                          ) : (
                            <>
                              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">
                                {t('Deliver within', 'وصّل خلال')}
                              </p>
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="bg-slate-700/60 rounded-xl px-4 py-1.5 min-w-[60px]">
                                  <span className="text-3xl font-black text-white tabular-nums">
                                    {String(cdMinutes).padStart(2, '0')}
                                  </span>
                                </div>
                                <span className="text-xl font-black text-slate-600">:</span>
                                <div className="bg-slate-700/60 rounded-xl px-4 py-1.5 min-w-[60px]">
                                  <span className="text-3xl font-black text-white tabular-nums">
                                    {String(cdSeconds).padStart(2, '0')}
                                  </span>
                                </div>
                              </div>
                              {(tipPending || tipActive) && (
                                <p className="text-emerald-400/70 text-[11px] font-semibold mt-2">
                                  {t(
                                    'Deliver on time to earn the tip below',
                                    'وصّل بالوقت لتحصل على الإكرامية أدناه'
                                  )}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="px-5 py-4 text-center border-b border-slate-700/40">
                          <p className="text-slate-500 text-sm animate-pulse">
                            {t('Calculating delivery time…', 'جاري حساب وقت التوصيل…')}
                          </p>
                        </div>
                      )}

                      {/* — Section 2: Total to collect — */}
                      <div className="px-5 py-5 text-center border-b border-slate-700/40">
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                          {tipActive
                            ? t('Collect (incl. tip)', 'حصّل (شامل الإكرامية)')
                            : t('Collect from customer', 'حصّل من العميل')}
                        </p>
                        <AnimatePresence mode="popLayout">
                          <motion.p
                            key={collectTotal.toFixed(2)}
                            initial={{ y: -8, opacity: 0, scale: 0.95 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 8, opacity: 0, scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                            className="text-5xl font-black text-white tabular-nums leading-none"
                          >
                            {collectTotal.toFixed(2)}
                            <span className="text-slate-500 text-lg font-bold ml-1.5">{fmtCurrency(activeOrder.currency)}</span>
                          </motion.p>
                        </AnimatePresence>

                        {/* Tip breakdown when included */}
                        {tipActive && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="mt-3 mx-auto max-w-[280px] space-y-1 text-xs"
                          >
                            <div className="flex justify-between text-slate-400">
                              <span>{t('Order', 'الطلب')}</span>
                              <span className="tabular-nums">{activeOrder.totalAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-emerald-400 font-semibold">
                              <span>{t('Tip', 'إكرامية')}</span>
                              <span className="tabular-nums">+{(activeOrder.tipAmount ?? 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-white font-bold text-sm pt-1 border-t border-slate-700/50">
                              <span>{t('Total', 'المجموع')}</span>
                              <span className="tabular-nums">{collectTotal.toFixed(2)}</span>
                            </div>
                          </motion.div>
                        )}
                      </div>

                      {/* — Section 3: Tip info — */}
                      {tipPending && (
                        <div className="px-5 py-4 border-b border-slate-700/40">
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center mt-0.5">
                              <Heart className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="text-emerald-400 text-sm font-bold">
                                  {t('Customer tip', 'إكرامية من العميل')}
                                </p>
                                <span className="text-emerald-400 text-xl font-black tabular-nums shrink-0">
                                  +{(activeOrder.tipAmount ?? 0).toFixed(2)}
                                </span>
                              </div>
                              <p className="text-slate-500 text-[11px] leading-relaxed mt-1">
                                {t(
                                  'The customer promised this tip if you deliver before the countdown ends. It\'s a gesture of appreciation — not an obligation. Deliver on time to earn it!',
                                  'العميل وعد بهذه الإكرامية إذا وصّلت قبل انتهاء العد التنازلي. هذه لفتة تقدير — ليست إلزامية. وصّل بالوقت لتحصل عليها!'
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tip removed by driver */}
                      {activeOrder.tipRemovedByDriver && (
                        <div className="px-5 py-3 border-b border-slate-700/40">
                          <p className="text-slate-500 text-xs text-center">
                            {t('You removed the tip from this order.', 'لقد أزلت الإكرامية من هذا الطلب.')}
                          </p>
                        </div>
                      )}

                      {/* — Section 4: Actions row — */}
                      <div className="px-4 py-3 flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setCalcOrderTotal(collectTotal)
                            setCalcCurrency(activeOrder.currency)
                            setCalcOpen(true)
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-white font-bold px-4 py-2.5 text-sm active:scale-[0.97] transition-all"
                        >
                          <Calculator className="w-4 h-4 text-slate-400" />
                          {t('Calculator', 'الحاسبة')}
                        </button>
                        {tipActive && activeOrder.status !== 'completed' && (
                          <motion.button
                            type="button"
                            onClick={() => setRemoveTipConfirmOpen(true)}
                            whileTap={{ scale: 0.95 }}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-400 font-semibold px-4 py-2.5 text-sm transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                            {t('Remove tip', 'إزالة الإكرامية')}
                          </motion.button>
                        )}
                      </div>
                    </div>
                  )
                })()}
                </div>

                {/* Motivational quote */}
                {!activeOrder.driverArrivedAt && activeOrder.driverPickedUpAt && (
                  <div className="text-center px-3 mb-4">
                    <p className="text-slate-500 text-sm leading-relaxed italic">
                      {DRIVER_MOTIVATIONAL_QUOTES[quoteIndex]}
                    </p>
                    <p className="text-slate-600 text-[10px] mt-1.5">
                      {t(
                        'Drive safe — your safety comes first.',
                        'سُق بأمان — سلامتك أولاً.'
                      )}
                    </p>
                  </div>
                )}

                {/* Contact cards (collapsible) */}
                <div className="space-y-2 mb-4">
                  {(activeOrder.customerName || activeOrder.customerPhone) && (
                    <div className="rounded-2xl bg-slate-800/40 border border-slate-700/40 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700/60 text-slate-400">
                            <User className="h-4 w-4" />
                          </div>
                          <span className="font-bold text-slate-200 text-sm truncate">
                            {activeOrder.customerName || '\u2014'}
                          </span>
                        </div>
                        {activeOrder.customerPhone && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={`tel:${activeOrder.customerPhone.replace(/\s/g, '')}`}
                              className="w-9 h-9 rounded-full bg-slate-700/60 hover:bg-slate-600 flex items-center justify-center text-emerald-400 active:scale-95 transition-all"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                            {getWhatsAppUrl(activeOrder.customerPhone) && (
                              <a
                                href={getWhatsAppUrl(activeOrder.customerPhone)!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-9 h-9 rounded-full bg-slate-700/60 hover:bg-slate-600 flex items-center justify-center text-[#25D366] active:scale-95 transition-all"
                              >
                                <Smartphone className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeOrder.businessWhatsapp && (
                    <div className="rounded-2xl bg-slate-800/40 border border-slate-700/40 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700/60 text-slate-400">
                            <Store className="h-4 w-4" />
                          </div>
                          <span className="font-bold text-slate-200 text-sm truncate">
                            {activeOrder.businessName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={`tel:${activeOrder.businessWhatsapp.replace(/\s/g, '')}`}
                            className="w-9 h-9 rounded-full bg-slate-700/60 hover:bg-slate-600 flex items-center justify-center text-emerald-400 active:scale-95 transition-all"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                          {getWhatsAppUrl(activeOrder.businessWhatsapp) && (
                            <a
                              href={getWhatsAppUrl(activeOrder.businessWhatsapp)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-9 h-9 rounded-full bg-slate-700/60 hover:bg-slate-600 flex items-center justify-center text-[#25D366] active:scale-95 transition-all"
                            >
                              <Smartphone className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

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
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-6 pt-6 pb-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                              <Trash2 className="w-5 h-5 text-slate-400" />
                            </div>
                            <h3 className="text-white text-lg font-black">
                              {t('Remove tip?', 'إزالة الإكرامية؟')}
                            </h3>
                          </div>
                          <p className="text-sm text-slate-400 leading-relaxed">
                            {t(
                              'This will update the total for both you and the customer.',
                              'سيتم تحديث المجموع لك وللعميل.'
                            )}
                          </p>
                        </div>
                        <div className="px-6 pb-6 flex gap-3">
                          <motion.button
                            type="button"
                            onClick={() => removeTip(activeOrder.orderId)}
                            disabled={removingTip}
                            whileTap={{ scale: 0.95 }}
                            className="flex-1 py-3.5 rounded-2xl font-bold text-sm bg-slate-800 border border-slate-700 text-white disabled:opacity-60 transition-all hover:bg-slate-700"
                          >
                            {removingTip
                              ? t('Removing…', 'جاري الإزالة…')
                              : t('Yes, remove', 'نعم، أزل')}
                          </motion.button>
                          <motion.button
                            type="button"
                            onClick={() => setRemoveTipConfirmOpen(false)}
                            whileTap={{ scale: 0.95 }}
                            className="flex-1 py-3.5 rounded-2xl font-bold text-sm bg-emerald-600 text-white transition-all hover:bg-emerald-500"
                          >
                            {t('Keep tip', 'أبقِ الإكرامية')}
                          </motion.button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Slide to arrive (enabled only when within 100m of customer) */}
                {!activeOrder.driverArrivedAt && (
                  <SlideToArrive
                    orderId={activeOrder.orderId}
                    onArrive={arrive}
                    disabled={!!actionId || !within100mOfCustomer}
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
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    {t('Report', 'إبلاغ')}
                  </button>
                  <button
                    onClick={() => cancel(activeOrder.orderId)}
                    disabled={actionId === activeOrder.orderId}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    {actionId === activeOrder.orderId
                      ? t('Cancelling\u2026', 'جاري الإلغاء\u2026')
                      : t('Cancel', 'إلغاء')}
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
                  {/* Small order badge + Personal Shopper badge */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-400 bg-slate-800/80 px-3 py-1 rounded-lg">
                      #{formatDriverOrderNumber(o.orderNumber)}
                    </span>
                    {o.requiresPersonalShopper && (
                      <span className="inline-flex items-center gap-1.5 text-amber-200 bg-amber-600/40 border border-amber-500/50 font-bold text-sm px-3 py-1.5 rounded-lg">
                        🛒 {t('Manual collection order', 'طلب تجميع يدوي')}
                      </span>
                    )}
                  </div>

                  {(o.items?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => openOrderDetails(o)}
                      className={`w-full mb-4 rounded-2xl font-black py-3.5 px-4 text-sm min-h-[52px] shadow-md flex items-center justify-center gap-2 ${
                        detailsOrderId === o.orderId
                          ? 'bg-amber-400 text-slate-950 border-2 border-amber-300'
                          : 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/20'
                      }`}
                    >
                      <Receipt className="h-5 w-5 shrink-0" />
                      {detailsOrderId === o.orderId
                        ? t('Hide order details', 'إخفاء تفاصيل الطلب')
                        : t('Order Details', 'تفاصيل الطلب')}
                      {o.requiresPersonalShopper && (
                        <span className="text-slate-700/80 text-xs font-semibold">
                          ({t('Personal Shopper', 'متسوق شخصي')})
                        </span>
                      )}
                    </button>
                  )}
                  {renderOrderDetailsPanel(o)}

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
                    {(o.requiresPersonalShopper || (o.shopperFee ?? 0) > 0) && (
                      <div className="rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 p-3.5 flex items-center justify-between">
                        <span className="text-fuchsia-200/85 text-xs font-semibold">🛍️ {t('Save Time fee', 'رسوم توفير الوقت')}</span>
                        <span className="font-black text-fuchsia-300 text-lg">
                          {(o.shopperFee ?? 0) > 0 ? `${(o.shopperFee ?? 0).toFixed(2)} ${fmtCurrency(o.currency)}` : t('FREE', 'مجاناً')}
                        </span>
                      </div>
                    )}
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

          const hasCountdown = isEnRoute && order.driverPickedUpAt && order.estimatedDeliveryMinutes
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
              orderId={order.orderId}
              onArrive={arrive}
              countdown={hasCountdown ? {
                driverPickedUpAt: order.driverPickedUpAt!,
                estimatedDeliveryMinutes: order.estimatedDeliveryMinutes!,
              } : undefined}
              orderInfo={isEnRoute ? {
                totalAmount: order.totalAmount,
                currency: order.currency,
                tipAmount: order.tipAmount,
                tipSentToDriver: order.tipSentToDriver,
                tipIncludedInTotal: order.tipIncludedInTotal,
                driverArrivedAt: order.driverArrivedAt,
              } : undefined}
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
