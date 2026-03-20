'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { OrdersClient, type Order } from '@/app/(main)/orders/OrdersClient'
import { OrderNotificationsWrapper } from '@/app/(main)/orders/OrderNotificationsWrapper'
import { useToast } from '@/components/ui/ToastProvider'
import { usePusherStream } from '@/lib/usePusherStream'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import type { AutoDeliveryDefaults } from '@/components/Orders/AutoDeliveryRequestControls'

/**
 * Business (tenant) orders list. Same pattern as customer track: initial fetch + SSE only, refetch on event.
 * List updates automatically when order status changes (new → preparing → driver_on_the_way → out-for-delivery → completed/cancelled) without polling.
 */
const DRIVER_CANCELLED_SOUND = '/sounds/1.wav'

type NewOrder = {
  _id: string
  orderNumber: string
  createdAt: string
  orderType?: 'delivery' | 'dine-in' | 'receive-in-person'
  customerName?: string
  customerPhone?: string
  tableNumber?: string
  deliveryAddress?: string
  deliveryArea?: { _id: string; name_en: string; name_ar: string }
  deliveryLat?: number
  deliveryLng?: number
  totalAmount?: number
  currency?: string
  scheduledFor?: string
  notifyAt?: string
}
export type TableRequest = {
  _id: string
  orderNumber: string
  tableNumber?: string
  customerRequestType?: 'call_waiter' | 'request_check'
  customerRequestPaymentMethod?: 'cash' | 'card'
  customerRequestedAt?: string
}
export type StandaloneTableRequest = { _id: string; tableNumber: string; type: string; createdAt: string }

export function TenantOrdersLive({
  slug,
  siteId,
  initialOrders,
  initialNewOrders,
  initialTableRequests,
  initialStandaloneTableRequests,
  initialOpenOrderId,
  initialNotificationSound,
  initialAutoDeliveryDefaults,
}: {
  slug: string
  siteId: string
  initialOrders: Order[]
  initialNewOrders: NewOrder[]
  initialTableRequests?: TableRequest[]
  initialStandaloneTableRequests?: StandaloneTableRequest[]
  /** Open this order in the modal (e.g. from ?open= or table request) */
  initialOpenOrderId?: string
  initialNotificationSound?: string
  initialAutoDeliveryDefaults?: AutoDeliveryDefaults
}) {
  const { showToast } = useToast()
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [newOrders, setNewOrders] = useState<NewOrder[]>(initialNewOrders)
  const [autoDeliveryDefaults, setAutoDeliveryDefaults] = useState<AutoDeliveryDefaults>(
    initialAutoDeliveryDefaults ?? {}
  )
  const [tableRequests, setTableRequests] = useState<TableRequest[]>(initialTableRequests ?? [])
  const [standaloneTableRequests, setStandaloneTableRequests] = useState<StandaloneTableRequest[]>(initialStandaloneTableRequests ?? [])
  const acknowledgedIdsRef = useRef<Set<string>>(new Set())
  const prevOrdersRef = useRef<Order[]>(initialOrders)
  const liveUpdateTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const [orderModalOpen, setOrderModalOpen] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [isForceRefreshing, setIsForceRefreshing] = useState(false)

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/tenants/${slug}/orders`, { cache: 'no-store' })
      if (!res.ok) return
      const {
        orders: nextOrders,
        newOrders: nextNewOrders,
        tableRequests: nextTableRequests,
        standaloneTableRequests: nextStandalone,
        autoDeliveryDefaults: nextAutoDefaults,
      } = await res.json()
      const nextOrdersList = Array.isArray(nextOrders) ? nextOrders : []
      const prevOrders = prevOrdersRef.current
      prevOrdersRef.current = nextOrdersList

      // Detect driver cancelled: delivery order was assigned, now has no driver (status preparing)
      for (const nextOrder of nextOrdersList) {
        if (nextOrder.orderType !== 'delivery' || nextOrder.status !== 'preparing' || nextOrder.assignedDriver) continue
        const prev = prevOrders.find((o) => o._id === nextOrder._id)
        if (prev?.assignedDriver) {
          try {
            const audio = new Audio(DRIVER_CANCELLED_SOUND)
            audio.volume = 1
            audio.play().catch(() => {})
          } catch (_) {}
          showToast(
            `Driver cancelled delivery for order #${nextOrder.orderNumber}. Order is available for other drivers.`,
            `ألغى السائق التوصيل للطلب #${nextOrder.orderNumber}. الطلب متاح لسائقيْن آخرين.`,
            'info'
          )
        }
      }

      setOrders(nextOrdersList)
      const nextNew = Array.isArray(nextNewOrders) ? nextNewOrders : []
      setNewOrders(nextNew.filter((o) => !acknowledgedIdsRef.current.has(o._id)))
      setTableRequests(Array.isArray(nextTableRequests) ? nextTableRequests : [])
      setStandaloneTableRequests(Array.isArray(nextStandalone) ? nextStandalone : [])
      if (nextAutoDefaults && typeof nextAutoDefaults === 'object') {
        setAutoDeliveryDefaults({
          defaultAutoDeliveryRequestMinutes: nextAutoDefaults.defaultAutoDeliveryRequestMinutes ?? null,
          saveAutoDeliveryRequestPreference: nextAutoDefaults.saveAutoDeliveryRequestPreference === true,
        })
      }
    } catch {
      // keep previous state
    }
  }, [slug, showToast])

  // When order-change event fires, refetch once after a short delay (100ms) then again for stragglers (600ms).
  // Debounced by usePusherStream so rapid events collapse into one trigger.
  const fetchOrdersOnLiveUpdate = useCallback(() => {
    liveUpdateTimeoutsRef.current.forEach(clearTimeout)
    liveUpdateTimeoutsRef.current = []
    const delays = [100, 600]
    liveUpdateTimeoutsRef.current = delays.map((ms) => setTimeout(fetchOrders, ms))
  }, [fetchOrders])

  useEffect(() => {
    return () => {
      liveUpdateTimeoutsRef.current.forEach(clearTimeout)
      liveUpdateTimeoutsRef.current = []
    }
  }, [])

  // Recovery fetch: if SSR returned empty (transient Sanity/network error), reload once on mount.
  useEffect(() => {
    if ((initialOrders?.length ?? 0) === 0) {
      void fetchOrders()
    }
  }, [fetchOrders, initialOrders])

  // Mobile-only UX guard: use non-blocking alerts to avoid full-screen dialog touch traps.
  useEffect(() => {
    const update = () => {
      setIsMobileViewport(window.matchMedia('(max-width: 767px)').matches)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const handleForceRefresh = useCallback(async () => {
    setIsForceRefreshing(true)
    try {
      await fetchOrders()
      showToast('Orders refreshed', 'تم تحديث الطلبات', 'success')
    } catch {
      showToast('Refresh failed', 'فشل تحديث الطلبات', 'error')
    } finally {
      setTimeout(() => setIsForceRefreshing(false), 300)
    }
  }, [fetchOrders, showToast])

  const handleAcknowledged = useCallback((orderId: string) => {
    acknowledgedIdsRef.current.add(orderId)
    setNewOrders((prev) => prev.filter((o) => o._id !== orderId))
    setOrders((prev) =>
      prev.map((o) => (o._id === orderId ? { ...o, status: 'preparing' as const } : o))
    )
  }, [])

  const handleTableRequestAcknowledged = useCallback((orderId: string) => {
    setTableRequests((prev) => prev.filter((o) => o._id !== orderId))
    const now = new Date().toISOString()
    setOrders((prev) =>
      prev.map((o) =>
        o._id === orderId ? { ...o, customerRequestAcknowledgedAt: now } : o
      )
    )
  }, [])

  const handleStandaloneTableRequestAcknowledged = useCallback((id: string) => {
    setStandaloneTableRequests((prev) => prev.filter((r) => r._id !== id))
  }, [])

  // Listeners for visibility and SW messages (no polling). Skip initial client fetch — we use server-rendered data.
  // Debounce visibility so rapid tab switches don't each trigger a Sanity read.
  const visibilityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const VISIBILITY_DEBOUNCE_MS = 800
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (visibilityDebounceRef.current) clearTimeout(visibilityDebounceRef.current)
      visibilityDebounceRef.current = setTimeout(() => {
        visibilityDebounceRef.current = null
        fetchOrders()
      }, VISIBILITY_DEBOUNCE_MS)
    }
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_NOTIFICATION_CLICK') fetchOrders()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onMessage)
    }
    return () => {
      if (visibilityDebounceRef.current) clearTimeout(visibilityDebounceRef.current)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onMessage)
      }
    }
  }, [fetchOrders])

  // Pusher: when any order for this tenant changes (new order, status, table request), refetch.
  // Debounce 500ms so rapid events (e.g. multiple orders) collapse into one fetch — reduces Sanity API usage.
  usePusherStream(siteId ? `tenant-${siteId}` : null, 'order-update', fetchOrdersOnLiveUpdate, { debounceMs: 500 })

  const openOrderIdForTableRequest = initialOpenOrderId || tableRequests[0]?._id

  return (
    <>
      <OrdersClient
        initialOrders={orders}
        tenantSlug={slug}
        skipProtection
        openOrderIdForTableRequest={openOrderIdForTableRequest}
        onAcknowledgeTableRequest={handleTableRequestAcknowledged}
        onModalOpenChange={setOrderModalOpen}
        autoDeliveryDefaults={autoDeliveryDefaults}
      />
      <OrderNotificationsWrapper
        initialNewOrders={newOrders}
        initialTableRequests={tableRequests}
        initialStandaloneTableRequests={standaloneTableRequests}
        tenantSlug={slug}
        autoDeliveryDefaults={autoDeliveryDefaults}
        initialNotificationSound={initialNotificationSound}
        onAcknowledged={handleAcknowledged}
        onTableRequestAcknowledged={handleTableRequestAcknowledged}
        onStandaloneTableRequestAcknowledged={handleStandaloneTableRequestAcknowledged}
        suppressDialog={orderModalOpen || isMobileViewport}
      />

      {/* Always-available manual refresh for recovery (above modals/overlays). */}
      <div className="fixed bottom-4 left-4 z-[450]">
        <Button
          type="button"
          onClick={handleForceRefresh}
          className="h-10 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white shadow-xl border border-cyan-400/40"
          disabled={isForceRefreshing}
          title="Force refresh orders"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isForceRefreshing ? 'animate-spin' : ''}`} />
          Force Refresh
        </Button>
      </div>
    </>
  )
}
