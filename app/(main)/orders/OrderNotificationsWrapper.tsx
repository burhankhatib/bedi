'use client'

import { OrderNotifications } from '@/components/Orders/OrderNotifications'
import { useCallback } from 'react'
import type { AutoDeliveryDefaults } from '@/components/Orders/AutoDeliveryRequestControls'

interface NewOrder {
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

export interface TableRequest {
  _id: string
  orderNumber: string
  tableNumber?: string
  customerRequestType?: 'call_waiter' | 'request_check'
  customerRequestPaymentMethod?: 'cash' | 'card'
  customerRequestedAt?: string
}

export interface StandaloneTableRequest {
  _id: string
  tableNumber: string
  type: string
  createdAt: string
}

interface OrderNotificationsWrapperProps {
  initialNewOrders: NewOrder[]
  /** Dine-in table requests (call waiter / request check) — triggers same ring as new orders */
  initialTableRequests?: TableRequest[]
  /** Standalone "call waiter" (no order) — from tableServiceRequest */
  initialStandaloneTableRequests?: StandaloneTableRequest[]
  /** When set, acknowledge uses tenant-scoped status API */
  tenantSlug?: string
  autoDeliveryDefaults?: AutoDeliveryDefaults
  /** Tenant's notification sound (from restaurantInfo) so sound works without global fetch */
  initialNotificationSound?: string
  /** Called after a successful acknowledge with the orderId (parent can update list immediately) */
  onAcknowledged?: (orderId: string) => void
  /** Called after acknowledging a table request */
  onTableRequestAcknowledged?: (orderId: string) => void
  /** Called after acknowledging a standalone table request */
  onStandaloneTableRequestAcknowledged?: (id: string) => void
  /** When true, only show volume control; hide the blocking alert dialog (e.g. when order details modal is open) */
  suppressDialog?: boolean
}

export function OrderNotificationsWrapper({
  initialNewOrders,
  initialTableRequests = [],
  initialStandaloneTableRequests = [],
  tenantSlug,
  autoDeliveryDefaults,
  initialNotificationSound,
  onAcknowledged,
  onTableRequestAcknowledged,
  onStandaloneTableRequestAcknowledged,
  suppressDialog = false,
}: OrderNotificationsWrapperProps) {
  const statusUrl = tenantSlug
    ? `/api/tenants/${tenantSlug}/orders/status`
    : '/api/orders/status'

  const handleAcknowledge = useCallback(async (orderId: string, statusOverride?: string, notifyAt?: string) => {
    try {
      const body: Record<string, string> = { 
        orderId, 
        status: statusOverride || 'preparing' 
      }
      if (notifyAt) body.notifyAt = notifyAt
      
      const response = await fetch(statusUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error('Failed to acknowledge order')
      onAcknowledged?.(orderId)
    } catch (error) {
      console.error('[OrderNotificationsWrapper] Error acknowledging order:', error)
      throw error
    }
  }, [statusUrl, onAcknowledged])

  const handleAcknowledgeTableRequest = useCallback(async (orderId: string) => {
    if (!tenantSlug) return
    try {
      const response = await fetch(statusUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, acknowledgeTableRequest: true }),
      })
      if (!response.ok) throw new Error('Failed to acknowledge table request')
      onTableRequestAcknowledged?.(orderId)
    } catch (error) {
      console.error('[OrderNotificationsWrapper] Error acknowledging table request:', error)
      throw error
    }
  }, [tenantSlug, statusUrl, onTableRequestAcknowledged])

  const handleAcknowledgeStandaloneTableRequest = useCallback(async (id: string) => {
    if (!tenantSlug) return
    try {
      const response = await fetch(`/api/tenants/${tenantSlug}/table-request/${id}/acknowledge`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) throw new Error('Failed to acknowledge standalone table request')
      onStandaloneTableRequestAcknowledged?.(id)
    } catch (error) {
      console.error('[OrderNotificationsWrapper] Error acknowledging standalone table request:', error)
      throw error
    }
  }, [tenantSlug, onStandaloneTableRequestAcknowledged])

  return (
    <OrderNotifications
      initialNewOrders={initialNewOrders}
      initialTableRequests={initialTableRequests}
      initialStandaloneTableRequests={initialStandaloneTableRequests}
      onAcknowledge={handleAcknowledge}
      onAcknowledgeTableRequest={handleAcknowledgeTableRequest}
      onAcknowledgeStandaloneTableRequest={handleAcknowledgeStandaloneTableRequest}
      tenantSlug={tenantSlug}
      autoDeliveryDefaults={autoDeliveryDefaults}
      initialNotificationSound={initialNotificationSound}
      suppressDialog={suppressDialog}
    />
  )
}
