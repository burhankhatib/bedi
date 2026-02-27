'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { OrdersClient, type Order } from '@/app/(main)/orders/OrdersClient'
import { OrderNotificationsWrapper } from '@/app/(main)/orders/OrderNotificationsWrapper'
import { useToast } from '@/components/ui/ToastProvider'
import { useSanityLiveStream } from '@/lib/useSanityLiveStream'

/**
 * Business (tenant) orders list. Same pattern as customer track: initial fetch + SSE only, refetch on event.
 * List updates automatically when order status changes (new → preparing → driver_on_the_way → out-for-delivery → completed/cancelled) without polling.
 */
const DRIVER_CANCELLED_SOUND = '/sounds/1.wav'

type NewOrder = { _id: string; orderNumber: string; createdAt: string }
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
}) {
  const { showToast } = useToast()
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [newOrders, setNewOrders] = useState<NewOrder[]>(initialNewOrders)
  const [tableRequests, setTableRequests] = useState<TableRequest[]>(initialTableRequests ?? [])
  const [standaloneTableRequests, setStandaloneTableRequests] = useState<StandaloneTableRequest[]>(initialStandaloneTableRequests ?? [])
  const acknowledgedIdsRef = useRef<Set<string>>(new Set())
  const prevOrdersRef = useRef<Order[]>(initialOrders)
  const liveUpdateTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/tenants/${slug}/orders`, { cache: 'no-store' })
      if (!res.ok) return
      const { orders: nextOrders, newOrders: nextNewOrders, tableRequests: nextTableRequests, standaloneTableRequests: nextStandalone } = await res.json()
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
    } catch {
      // keep previous state
    }
  }, [slug, showToast])

  // When Sanity sends an order-change event, refetch after short delays so the DB has propagated
  // (table request / new order). Multiple retries so "Call the waiter" (fast click) is reliably seen on desktop.
  const fetchOrdersOnLiveUpdate = useCallback(() => {
    liveUpdateTimeoutsRef.current.forEach(clearTimeout)
    liveUpdateTimeoutsRef.current = []
    const delays = [400, 800, 1500]
    liveUpdateTimeoutsRef.current = delays.map((ms) => setTimeout(fetchOrders, ms))
  }, [fetchOrders])

  useEffect(() => {
    return () => {
      liveUpdateTimeoutsRef.current.forEach(clearTimeout)
      liveUpdateTimeoutsRef.current = []
    }
  }, [])

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

  // Initial load (one GET). No polling.
  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // SSE: when any order for this tenant changes (new order, status, table request), refetch with
  // delay + one retry so we see the update even if Sanity read is briefly stale (no extra polling).
  useSanityLiveStream(slug ? `/api/tenants/${slug}/orders/live` : null, fetchOrdersOnLiveUpdate)

  const openOrderIdForTableRequest = initialOpenOrderId || tableRequests[0]?._id

  return (
    <>
      <OrdersClient
        initialOrders={orders}
        tenantSlug={slug}
        skipProtection
        openOrderIdForTableRequest={openOrderIdForTableRequest}
        onAcknowledgeTableRequest={handleTableRequestAcknowledged}
      />
      <OrderNotificationsWrapper
        initialNewOrders={newOrders}
        initialTableRequests={tableRequests}
        initialStandaloneTableRequests={standaloneTableRequests}
        tenantSlug={slug}
        initialNotificationSound={initialNotificationSound}
        onAcknowledged={handleAcknowledged}
        onTableRequestAcknowledged={handleTableRequestAcknowledged}
        onStandaloneTableRequestAcknowledged={handleStandaloneTableRequestAcknowledged}
      />
    </>
  )
}
