'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Package, Truck, UtensilsCrossed, Store, Clock, CheckCircle2, XCircle, ChefHat, Search, ChevronDown, ChevronUp, Filter, LayoutGrid, List, Undo2, Settings, Phone, MessageCircle, UserMinus, Bike } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { AdminProtection } from '@/components/Auth/AdminProtection'
import { OrderDetailsModal } from '@/components/Orders/OrderDetailsModal'
import { AutoDeliveryRequestControls, type AutoDeliveryDefaults } from '@/components/Orders/AutoDeliveryRequestControls'
import { OrderNotifications } from '@/components/Orders/OrderNotifications'
import { Input } from '@/components/ui/input'
import { getDriverDisplayNameForBusiness } from '@/lib/driver-display'
import { motion, AnimatePresence } from 'framer-motion'

export interface OrderItem {
  _key: string
  productName: string
  quantity: number
  price: number
  total: number
  notes?: string
  addOns?: string
}

export interface Order {
  _id: string
  orderNumber: string
  orderType: 'receive-in-person' | 'dine-in' | 'delivery'
  status: 'new' | 'acknowledged' | 'preparing' | 'waiting_for_delivery' | 'driver_on_the_way' | 'out-for-delivery' | 'completed' | 'served' | 'cancelled' | 'refunded'
  customerName: string
  tableNumber?: string
  customerPhone?: string
  deliveryArea?: {
    _id: string
    name_en: string
    name_ar: string
  }
  deliveryAddress?: string
  deliveryFee?: number
  deliveryFeePaidByBusiness?: boolean
  assignedDriver?: {
    _id: string
    name: string
    nickname?: string
    phoneNumber: string
    deliveryAreas?: Array<{
      _id: string
      name_en: string
      name_ar: string
    }>
  }
  items: OrderItem[]
  subtotal: number
  totalAmount: number
  currency: string
  createdAt: string
  scheduledFor?: string
  acknowledgedAt?: string
  preparedAt?: string
  driverAcceptedAt?: string
  driverPickedUpAt?: string
  completedAt?: string
  cancelledAt?: string
  driverCancelledAt?: string
  driverDeclinedAssignmentAt?: string
  scheduleEditHistory?: Array<{
    _key?: string
    previousScheduledFor: string
    changedAt: string
  }>
  customerRequestType?: 'call_waiter' | 'request_check'
  customerRequestPaymentMethod?: 'cash' | 'card'
  customerRequestedAt?: string
  customerRequestAcknowledgedAt?: string
  tipPercent?: number
  tipAmount?: number
  tipSentToDriver?: boolean
  driverArrivedAt?: string
  deliveryRequestedAt?: string | null
  autoDeliveryRequestMinutes?: number | null
  autoDeliveryRequestScheduledAt?: string | null
  autoDeliveryRequestTriggeredAt?: string | null
}

const STATUS_CONFIG = {
  new: { label: 'New', labelAr: 'جديد', icon: Package, color: 'bg-blue-500', textColor: 'text-blue-600' },
  acknowledged: { label: 'Acknowledged', labelAr: 'تم الاستلام', icon: Package, color: 'bg-blue-400', textColor: 'text-blue-500' },
  preparing: { label: 'Preparing', labelAr: 'قيد التحضير', icon: ChefHat, color: 'bg-orange-500', textColor: 'text-orange-600' },
  waiting_for_delivery: { label: 'Waiting for Delivery', labelAr: 'في انتظار التوصيل', icon: Clock, color: 'bg-amber-500', textColor: 'text-amber-600' },
  driver_on_the_way: { label: 'Driver on the way to pick up', labelAr: 'السائق في الطريق لاستلام الطلب', icon: Truck, color: 'bg-blue-500', textColor: 'text-blue-600' },
  'out-for-delivery': { label: 'Driver on the way to you', labelAr: 'السائق في الطريق إليك', icon: Truck, color: 'bg-purple-500', textColor: 'text-purple-600' },
  completed: { label: 'Delivered & COMPLETED', labelAr: 'تم التوصيل ومكتمل', icon: CheckCircle2, color: 'bg-green-500', textColor: 'text-green-600' },
  served: { label: 'Served', labelAr: 'تم التقديم', icon: UtensilsCrossed, color: 'bg-green-500', textColor: 'text-green-600' },
  cancelled: { label: 'Cancelled', labelAr: 'ملغي', icon: XCircle, color: 'bg-red-500', textColor: 'text-red-600' },
  refunded: { label: 'Refunded', labelAr: 'مسترد', icon: XCircle, color: 'bg-amber-600', textColor: 'text-amber-600' },
}

interface OrdersClientProps {
  initialOrders: Order[]
  /** When set, status updates use tenant-scoped API */
  tenantSlug?: string
  /** When true, skip AdminProtection (e.g. on tenant orders page) */
  skipProtection?: boolean
  /** Open this order in the modal (e.g. table request or ?open=) */
  openOrderIdForTableRequest?: string
  /** Called after acknowledging a table request (stops ringing, updates UI) */
  onAcknowledgeTableRequest?: (orderId: string) => void
  /** Called when the order details modal opens or closes (so parent can hide blocking dialogs) */
  onModalOpenChange?: (open: boolean) => void
  /** Tenant auto-request defaults (from GET orders); updates when parent refetches */
  autoDeliveryDefaults?: AutoDeliveryDefaults
}

function showAutoDeliveryRow(order: Order, tenantSlug?: string) {
  if (!tenantSlug) return false
  if (order.orderType !== 'delivery') return false
  if (order.assignedDriver) return false
  if (order.deliveryRequestedAt) return false
  if (['cancelled', 'refunded'].includes(order.status)) return false
  return ['new', 'acknowledged', 'preparing', 'waiting_for_delivery'].includes(order.status)
}

export function OrdersClient({
  initialOrders,
  tenantSlug,
  skipProtection,
  openOrderIdForTableRequest,
  onAcknowledgeTableRequest,
  onModalOpenChange,
  autoDeliveryDefaults,
}: OrdersClientProps) {
  const { t, lang } = useLanguage()
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [activeTab, setActiveTab] = useState<'live' | 'scheduled'>('live')
  const [filterType, setFilterType] = useState<string>('all')
  const [hiddenStatuses, setHiddenStatuses] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const isUpdatingStatusRef = useRef(false)
  const [undoTimeout, setUndoTimeout] = useState<number>(5)
  const [drivers, setDrivers] = useState<any[]>([])
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [showOfflineDrivers, setShowOfflineDrivers] = useState(false)
  
  // Modals for quick actions
  const [customerModalOrder, setCustomerModalOrder] = useState<Order | null>(null)
  const [statusModalOrder, setStatusModalOrder] = useState<Order | null>(null)
  const [driverModalOrder, setDriverModalOrder] = useState<Order | null>(null)
  const [assignDropdownOrder, setAssignDropdownOrder] = useState<string | null>(null) // holds orderId
  const [showDeliveryToast, setShowDeliveryToast] = useState(false)

  const [pendingUpdate, setPendingUpdate] = useState<{
    orderId: string
    newStatus: string
    notifyAt?: string
    newScheduledFor?: string
    oldOrder: Order
    timeoutId: NodeJS.Timeout
    startTime: number
  } | null>(null)

  // Initialize from localStorage on mount
  useEffect(() => {
    try {
      const storedStatuses = localStorage.getItem('orders_hidden_statuses')
      if (storedStatuses) {
        const parsed = JSON.parse(storedStatuses)
        const allStatuses = Object.keys(STATUS_CONFIG)
        if (Array.isArray(parsed) && parsed.length < allStatuses.length) {
          setHiddenStatuses(parsed)
        } else {
          setHiddenStatuses([])
          localStorage.setItem('orders_hidden_statuses', JSON.stringify([]))
        }
      }
      
      const storedView = localStorage.getItem('orders_view_mode')
      if (storedView === 'grid' || storedView === 'table') {
        setViewMode(storedView)
      }

      const storedTimeout = localStorage.getItem('orders_undo_timeout')
      if (storedTimeout) {
        setUndoTimeout(Number(storedTimeout))
      }
    } catch (e) {
      console.error('Failed to load local storage preferences', e)
    }
  }, [])

  useEffect(() => {
    if (tenantSlug) {
      setLoadingDrivers(true)
      fetch(`/api/tenants/${tenantSlug}/drivers`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setDrivers(data)
          }
        })
        .catch(console.error)
        .finally(() => setLoadingDrivers(false))
    }
  }, [tenantSlug])

  const toggleHiddenStatus = (status: string) => {
    setHiddenStatuses(prev => {
      const next = prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
      localStorage.setItem('orders_hidden_statuses', JSON.stringify(next))
      return next
    })
  }

  const handleViewModeChange = (mode: 'grid' | 'table') => {
    setViewMode(mode)
    localStorage.setItem('orders_view_mode', mode)
  }

  // Update orders when initialOrders changes (from SanityLive)
  useEffect(() => {
    // Only update if we're not currently updating a status manually
    if (!isUpdatingStatusRef.current) {
      setOrders(initialOrders)
      // Also update selectedOrder if it exists to keep modal in sync
      setSelectedOrder(prevSelected => {
        if (prevSelected) {
          const updatedOrder = initialOrders.find(o => o._id === prevSelected._id)
          return updatedOrder || prevSelected
        }
        return prevSelected
      })
    }
  }, [initialOrders])

  // Open order modal when we have a table request (or ?open=) so staff sees the request
  useEffect(() => {
    if (!openOrderIdForTableRequest || !orders.length) return
    const order = orders.find((o) => o._id === openOrderIdForTableRequest)
    if (!order) return
    // Keep "new" orders in the New Order alert flow so staff sees Accept + auto-delivery controls.
    const hasTableRequest = !!(order.customerRequestedAt && !order.customerRequestAcknowledgedAt)
    if (order.status === 'new' && !hasTableRequest) return
    setSelectedOrder(order)
  }, [openOrderIdForTableRequest, orders])

  // Notify parent when modal opens/closes so the red-bell dialog can be hidden and modal is clickable
  useEffect(() => {
    onModalOpenChange?.(selectedOrder != null)
  }, [selectedOrder, onModalOpenChange])

  const toLocalDateKey = (value: string) => {
    const d = new Date(value)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const executeStatusUpdate = async (orderId: string, newStatus: string, notifyAt?: string, oldOrder?: Order, newScheduledFor?: string) => {
    try {
      const payload: { orderId: string; status: string; completedAt?: string; notifyAt?: string; newScheduledFor?: string } = {
        orderId,
        status: newStatus,
      };

      if (notifyAt) payload.notifyAt = notifyAt;
      if (newScheduledFor) payload.newScheduledFor = newScheduledFor;

      if (newStatus === 'completed') {
        payload.completedAt = new Date().toISOString();
      }

      console.log('Updating order status:', { orderId, newStatus, payload });

      const statusUrl = tenantSlug
        ? `/api/tenants/${tenantSlug}/orders/status`
        : '/api/orders/status'
      const response = await fetch(statusUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        const base =
          (typeof responseData.error === 'string' && responseData.error) ||
          `Failed to update order status: ${response.status} ${response.statusText}`
        const details =
          typeof (responseData as { details?: string }).details === 'string'
            ? (responseData as { details?: string }).details
            : ''
        throw new Error(details ? `${base} — ${details}` : base)
      }

      if (!responseData.success) {
        throw new Error('Update did not return success');
      }

      setTimeout(() => {
        isUpdatingStatusRef.current = false;
        if (newScheduledFor) {
          window.location.reload();
        }
      }, 1000);
      
    } catch (error) {
      console.error('Failed to update order status:', error);
      isUpdatingStatusRef.current = false;

      // Revert optimistic update
      if (oldOrder) {
        setOrders(prev => prev.map(o => o._id === orderId ? oldOrder : o));
      } else {
        setOrders(initialOrders);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to update order status:\n\n${errorMessage}\n\nPlease check the browser console for more details.`);
    }
  }

  const updateOrderStatus = (orderId: string, newStatus: string, notifyAt?: string, newScheduledFor?: string) => {
    // Clear any existing pending update
    if (pendingUpdate) {
      clearTimeout(pendingUpdate.timeoutId)
      // Execute the pending update immediately if a new one is started
      executeStatusUpdate(pendingUpdate.orderId, pendingUpdate.newStatus, pendingUpdate.notifyAt, pendingUpdate.oldOrder, pendingUpdate.newScheduledFor)
      setPendingUpdate(null)
    }

    isUpdatingStatusRef.current = true;
    
    // Find the old order for potential revert
    const oldOrder = orders.find(o => o._id === orderId)
    if (!oldOrder) return

    // Optimistically update the order in local state immediately
    setOrders(prevOrders => {
      return prevOrders.map(order => {
        if (order._id === orderId) {
          const updatedOrder = {
            ...order,
            status: newStatus as Order['status'],
            ...(notifyAt && { notifyAt, reminderSent: false })
          };
          
          if (newStatus === 'completed') {
            updatedOrder.completedAt = new Date().toISOString();
          }
          
          if (newScheduledFor && newScheduledFor !== order.scheduledFor) {
            updatedOrder.scheduledFor = newScheduledFor;
            if (order.scheduledFor) {
              updatedOrder.scheduleEditHistory = [
                ...(order.scheduleEditHistory || []),
                {
                  _key: `history-${Date.now()}`,
                  previousScheduledFor: order.scheduledFor,
                  changedAt: new Date().toISOString()
                }
              ];
            }
          }
          
          return updatedOrder;
        }
        return order;
      });
    });

    setSelectedOrder(null);

    // Set up the undo timeout
    const timeoutId = setTimeout(() => {
      setPendingUpdate(null)
      executeStatusUpdate(orderId, newStatus, notifyAt, oldOrder, newScheduledFor)
    }, undoTimeout * 1000)

    setPendingUpdate({
      orderId,
      newStatus,
      notifyAt,
      newScheduledFor,
      oldOrder,
      timeoutId,
      startTime: Date.now()
    })
  };

  const undoStatusUpdate = () => {
    if (!pendingUpdate) return
    
    clearTimeout(pendingUpdate.timeoutId)
    
    // Revert local state
    setOrders(prevOrders => {
      return prevOrders.map(order => {
        if (order._id === pendingUpdate.orderId) {
          return pendingUpdate.oldOrder
        }
        return order
      })
    })
    
    setPendingUpdate(null)
    isUpdatingStatusRef.current = false
  }

  const assignDriver = async (orderId: string, driverId: string) => {
    try {
      const res = await fetch(`/api/tenants/${tenantSlug}/orders/assign-driver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, driverId })
      })
      if (res.ok) {
        const driver = drivers.find(d => d._id === driverId)
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, assignedDriver: driver } : o))
        setAssignDropdownOrder(null)
      } else {
        alert('Failed to assign driver')
      }
    } catch (e) {
      console.error(e)
      alert('Error assigning driver')
    }
  }

  const unassignDriver = async (orderId: string) => {
    try {
      const res = await fetch(`/api/tenants/${tenantSlug}/orders/unassign-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      })
      if (res.ok) {
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, assignedDriver: undefined } : o))
        setDriverModalOrder(null)
      } else {
        alert('Failed to unassign driver')
      }
    } catch (e) {
      console.error(e)
      alert('Error unassigning driver')
    }
  }

  const applyAutoDeliveryPatch = useCallback((orderId: string, partial: Partial<Order>) => {
    setOrders((prev) => prev.map((o) => (o._id === orderId ? { ...o, ...partial } : o)))
    setSelectedOrder((prev) => (prev && prev._id === orderId ? { ...prev, ...partial } : prev))
  }, [])

  const requestDelivery = async (orderId: string) => {
    try {
      const res = await fetch(`/api/tenants/${tenantSlug}/orders/request-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      })
      if (res.ok) {
        applyAutoDeliveryPatch(orderId, {
          deliveryRequestedAt: new Date().toISOString(),
          autoDeliveryRequestMinutes: null,
          autoDeliveryRequestScheduledAt: null,
        })
        setShowDeliveryToast(true)
        setTimeout(() => setShowDeliveryToast(false), 4000)
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || 'Failed to request delivery');
      }
    } catch (e) {
      console.error(e)
      alert('Error requesting delivery')
    }
  }

  // Client-side filtering
  const filteredOrders = (orders || []).filter(order => {
    // Tab filtering
    const isScheduled = !!order.scheduledFor;
    const isScheduledButLive = isScheduled && !['new', 'acknowledged'].includes(order.status);

    if (activeTab === 'live') {
      if (isScheduled && !isScheduledButLive) return false;
    }
    if (activeTab === 'scheduled') {
      if (!isScheduled || isScheduledButLive) return false;
    }

    // Exclude "new" status orders from live view (they're handled by notifications), unless they are scheduled or table requests
    const hasTableRequest = order.orderType === 'dine-in' && order.customerRequestedAt && !order.customerRequestAcknowledgedAt;
    if (activeTab === 'live' && order.status === 'new' && !hasTableRequest) return false;

    // Date filtering (only if dates are set, otherwise show all)
    if (startDate && endDate) {
      const orderDate = toLocalDateKey(order.createdAt);
      if (orderDate < startDate || orderDate > endDate) return false;
    } else if (startDate) {
      const orderDate = toLocalDateKey(order.createdAt);
      if (orderDate !== startDate) return false;
    }

    // Status filter
    if (hiddenStatuses.includes(order.status)) return false;

    // Type filter
    if (filterType !== 'all' && order.orderType !== filterType) return false;

    // Search term filter
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase().trim();
      const customerName = (order.customerName || '').toLowerCase();
      const customerPhone = (order.customerPhone || '').toLowerCase();
      const orderNumber = (order.orderNumber || '').toLowerCase();

      const matchesSearch = customerName.includes(query) ||
        customerPhone.includes(query) ||
        orderNumber.includes(query);

      if (!matchesSearch) return false;
    }

    return true;
  }).sort((a, b) => {
    if (activeTab === 'scheduled') {
      // Sort scheduled orders by scheduledFor ascending (earliest first)
      const dateA = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
      const dateB = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
      return dateA - dateB;
    } else {
      // Default live sorting (newest first based on createdAt)
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    }
  });

  const content = (
    <>
      {/* OrderNotifications is now handled by OrderNotificationsWrapper */}

      <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900">
        <div className="max-w-7xl mx-auto relative">
          
          {/* Undo Toast Notification */}
          <AnimatePresence>
            {pendingUpdate && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-slate-700 w-[90%] max-w-md"
              >
                <div className="flex-1">
                  <p className="font-bold text-sm mb-1">{t('Order Status Changed', 'تم تغيير حالة الطلب')}</p>
                  <p className="text-xs text-slate-300">
                    Order #{orders.find(o => o._id === pendingUpdate.orderId)?.orderNumber} to {
                      STATUS_CONFIG[pendingUpdate.newStatus as keyof typeof STATUS_CONFIG]?.label || pendingUpdate.newStatus
                    }
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative w-8 h-8 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-700" />
                      <motion.circle 
                        cx="16" cy="16" r="14" 
                        stroke="currentColor" 
                        strokeWidth="3" 
                        fill="transparent" 
                        className="text-orange-500"
                        strokeDasharray={2 * Math.PI * 14}
                        initial={{ strokeDashoffset: 0 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 14 }}
                        transition={{ duration: undoTimeout, ease: 'linear' }}
                      />
                    </svg>
                  </div>
                  <Button 
                    onClick={undoStatusUpdate}
                    variant="ghost" 
                    className="bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl flex items-center gap-2"
                  >
                    <Undo2 className="w-4 h-4" />
                    {t('UNDO', 'تراجع')}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Delivery Toast Notification */}
          <AnimatePresence>
            {showDeliveryToast && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-blue-500 w-[90%] max-w-sm overflow-hidden"
              >
                <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden flex items-center">
                  <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: '-200%' }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-full flex justify-end"
                  >
                    <Bike className="w-16 h-16" />
                  </motion.div>
                </div>
                <div className="relative z-10 flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-full shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-sm leading-tight">{t('Delivery requested!', 'تم طلب التوصيل!')}</p>
                    <p className="text-xs text-blue-100 mt-0.5">{t('Driver is on the way.', 'السائق في الطريق.')}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-white rounded-3xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-black mb-1">{t('Orders Management', 'إدارة الطلبات')}</h1>
                <p className="text-slate-500 text-sm md:text-base">
                  {t('All orders up to date', 'جميع الطلبات محدثة')}
                </p>
              </div>
              <Button
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                variant="outline"
                className="rounded-xl border-slate-200 hover:bg-slate-50 shrink-0 min-h-10"
              >
                <Filter className="w-4 h-4 mr-2" />
                <span className="font-semibold hidden sm:inline">{t('Filters', 'الفلاتر')}</span>
                <motion.div
                  animate={{ rotate: filtersExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="ml-2"
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.div>
              </Button>
            </div>

            {/* Collapsible Filters */}
            <AnimatePresence>
              {filtersExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden mb-4"
                >
                  <div className="space-y-4 pb-4">
                    {/* Undo Settings */}
                    <div className="flex justify-end mb-2">
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl">
                        <Settings className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-600">Undo Time:</span>
                        <select 
                          className="bg-white border border-slate-300 text-sm rounded-lg px-2 py-1 outline-none"
                          value={undoTimeout}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setUndoTimeout(val);
                            localStorage.setItem('orders_undo_timeout', String(val));
                          }}
                        >
                          <option value={5}>5s</option>
                          <option value={10}>10s</option>
                          <option value={15}>15s</option>
                        </select>
                      </div>
                    </div>
                    {/* Search and Date Filters */}
                    <div className="flex flex-col md:flex-row gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="Search by name, phone, or order number..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-fit rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-fit rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Status and Type Filters */}
                    <div className="space-y-3">
                      {/* Status Filters */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-slate-600">Status (Uncheck to hide):</span>
                          {hiddenStatuses.length > 0 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700"
                              onClick={() => {
                                setHiddenStatuses([]);
                                localStorage.setItem('orders_hidden_statuses', JSON.stringify([]));
                              }}
                            >
                              Show All
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                            const isHidden = hiddenStatuses.includes(status);
                            return (
                              <button
                                key={status}
                                onClick={() => toggleHiddenStatus(status)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                                  isHidden 
                                    ? 'border-slate-200 bg-white text-slate-400 opacity-60' 
                                    : `border-transparent ${config.color} text-white shadow-sm`
                                }`}
                              >
                                {isHidden ? <div className="w-3.5 h-3.5 rounded-sm border-2 border-slate-300" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                <config.icon className="w-3.5 h-3.5" />
                                {lang === 'ar' ? config.labelAr : config.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Type Filters */}
                      <div>
                        <span className="text-sm font-semibold text-slate-600 mb-2 block">Type:</span>
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar -mx-2 px-2">
                          <div className="flex gap-2 min-w-max">
                            <Button
                              onClick={() => setFilterType('all')}
                              variant={filterType === 'all' ? 'default' : 'outline'}
                              size="sm"
                              className="rounded-lg shrink-0"
                            >
                              {t('All Types', 'جميع الأنواع')}
                            </Button>
                            <Button
                              onClick={() => setFilterType('receive-in-person')}
                              variant={filterType === 'receive-in-person' ? 'default' : 'outline'}
                              size="sm"
                              className="rounded-lg shrink-0"
                            >
                              <Store className="w-4 h-4 mr-1" />
                              {t('Receive in Person', 'استلام شخصي')}
                            </Button>
                            <Button
                              onClick={() => setFilterType('dine-in')}
                              variant={filterType === 'dine-in' ? 'default' : 'outline'}
                              size="sm"
                              className="rounded-lg shrink-0"
                            >
                              <UtensilsCrossed className="w-4 h-4 mr-1" />
                              {t('Dine-in', 'تناول هنا')}
                            </Button>
                            <Button
                              onClick={() => setFilterType('delivery')}
                              variant={filterType === 'delivery' ? 'default' : 'outline'}
                              size="sm"
                              className="rounded-lg shrink-0"
                            >
                              <Truck className="w-4 h-4 mr-1" />
                              {t('Delivery', 'توصيل')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tabs and Views Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 mb-6 gap-4 sm:gap-0 pb-0">
            <div className="flex">
              <button
                className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors ${activeTab === 'live' ? 'border-orange-500 text-orange-500' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                onClick={() => setActiveTab('live')}
              >
                {t('Live Orders', 'الطلبات المباشرة')}
              </button>
              <button
                className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'scheduled' ? 'border-orange-500 text-orange-500' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                onClick={() => setActiveTab('scheduled')}
              >
                {t('Scheduled Orders', 'الطلبات المجدولة')}
                {(() => {
                  const count = (orders || []).filter(o => {
                    const isSched = !!o.scheduledFor;
                    const isScheduledButLive = isSched && !['new', 'acknowledged'].includes(o.status);
                    return isSched && !isScheduledButLive && o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'refunded';
                  }).length;
                  
                  if (count === 0) return null;
                  
                  return (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex h-5 items-center justify-center rounded-full bg-purple-100 px-2 text-xs font-black text-purple-700 dark:bg-purple-900/60 dark:text-purple-300"
                    >
                      {count}
                    </motion.span>
                  );
                })()}
              </button>
            </div>
            
            <div className="flex items-center gap-2 pb-3 sm:pb-0">
              <span className="text-sm font-semibold text-slate-500 mr-2">{t('View:', 'العرض:')}</span>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => handleViewModeChange('grid')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                  title={t('Grid View', 'عرض شبكي')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleViewModeChange('table')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                  title={t('Table View', 'عرض جدول')}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Orders Display */}
          <div className="bg-white rounded-3xl shadow-lg p-6">
            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-lg p-8 md:p-12 text-center">
                <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-400 mb-2">{t('No orders found', 'لا توجد طلبات')}</h3>
                <p className="text-slate-400">{t('Try adjusting your filters', 'جرّب تعديل الفلاتر')}</p>
              </div>
            ) : viewMode === 'table' ? (
              <div className="flex flex-col gap-3">
                {filteredOrders.map((order) => {
                  const deliveryOnlyStatuses = ['waiting_for_delivery', 'driver_on_the_way', 'out-for-delivery']
                  const isDeliveryOrder = order.orderType === 'delivery'
                  const effectiveStatus = (!isDeliveryOrder && deliveryOnlyStatuses.includes(order.status)) ? 'preparing' : order.status
                  const statusConfig = STATUS_CONFIG[effectiveStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.new;
                  const orderTime = new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div 
                      key={order._id} 
                      className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden group"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Order Number (clickable) */}
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                            className="font-black text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-sm transition-colors"
                          >
                            #{order.orderNumber.slice(-4)}
                          </button>
                          
                          {/* Time */}
                          <span className="text-xs font-medium text-slate-400">{orderTime}</span>
                          
                          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                          {/* Customer Name (clickable) */}
                          <button 
                            onClick={(e) => { e.stopPropagation(); setCustomerModalOrder(order); }}
                            className="flex flex-col items-start bg-slate-50 hover:bg-slate-100 rounded-xl px-3 py-1.5 transition-colors border border-slate-100"
                          >
                            <span className="font-bold text-slate-700 truncate max-w-[150px]" title={order.customerName}>
                              {order.customerName}
                            </span>
                            {order.customerPhone && (
                              <span className="text-xs text-slate-500 font-mono" dir="ltr">{order.customerPhone}</span>
                            )}
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          {/* Status Button (clickable) */}
                          <button 
                            onClick={(e) => { e.stopPropagation(); setStatusModalOrder(order); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition-transform hover:scale-105 active:scale-95 ${statusConfig.color}`}
                          >
                            <statusConfig.icon className="w-3.5 h-3.5" />
                            {lang === 'ar' ? statusConfig.labelAr : statusConfig.label}
                            <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
                          </button>

                          {/* Delivery Action */}
                          {isDeliveryOrder && !['cancelled', 'refunded'].includes(order.status) && (
                            <div className="relative">
                              {order.assignedDriver ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDriverModalOrder(order); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 text-xs font-bold transition-colors"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                  {getDriverDisplayNameForBusiness(order.assignedDriver).split(' ')[0]}
                                  <ChevronDown className="w-3 h-3 opacity-70" />
                                </button>
                              ) : (
                                <>
                                  {showAutoDeliveryRow(order, tenantSlug) && tenantSlug && (
                                    <div className="mb-2 w-full" onClick={(e) => e.stopPropagation()}>
                                      <AutoDeliveryRequestControls
                                        tenantSlug={tenantSlug}
                                        orderId={order._id}
                                        deliveryRequestedAt={order.deliveryRequestedAt}
                                        autoDeliveryRequestMinutes={order.autoDeliveryRequestMinutes}
                                        autoDeliveryRequestScheduledAt={order.autoDeliveryRequestScheduledAt}
                                        tenantDefaults={autoDeliveryDefaults}
                                        emphasize={order.status === 'new'}
                                        onPatched={(p) => applyAutoDeliveryPatch(order._id, p)}
                                      />
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); requestDelivery(order._id); }}
                                      className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 sm:py-1.5 rounded-xl bg-blue-100 text-blue-700 hover:bg-blue-200 active:scale-[0.97] active:bg-blue-300 text-sm sm:text-xs font-bold transition-all duration-150 ease-out shadow-sm border border-blue-200/50 touch-manipulation"
                                    >
                                      <Truck className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
                                      {t('Request Delivery', 'طلب توصيل')}
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setAssignDropdownOrder(assignDropdownOrder === order._id ? null : order._id); }}
                                      className="flex items-center justify-center px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200 shadow-sm"
                                    >
                                      <ChevronDown className="w-4 h-4 opacity-70" />
                                    </button>
                                  </div>
                                  
                                  {/* Assign Driver Dropdown */}
                                  <AnimatePresence>
                                    {assignDropdownOrder === order._id && (
                                      <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute right-0 sm:left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-40 overflow-hidden"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                      <div className="p-3 border-b border-slate-100 bg-slate-50">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input 
                                            type="checkbox" 
                                            checked={showOfflineDrivers}
                                            onChange={(e) => setShowOfflineDrivers(e.target.checked)}
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                          />
                                          <span className="text-xs font-medium text-slate-600">
                                            {t('Show offline drivers', 'إظهار السائقين غير المتصلين')}
                                          </span>
                                        </label>
                                      </div>
                                      <div className="max-h-60 overflow-y-auto">
                                        {loadingDrivers ? (
                                          <p className="p-4 text-center text-xs text-slate-400">Loading...</p>
                                        ) : drivers.filter(d => showOfflineDrivers || d.isOnline).length === 0 ? (
                                          <p className="p-4 text-center text-xs text-slate-400">
                                            {t('No drivers available.', 'لا يوجد سائقين متاحين.')}
                                          </p>
                                        ) : (
                                          drivers.filter(d => showOfflineDrivers || d.isOnline).map(driver => {
                                            // Check area compatibility
                                            const canServe = !order.deliveryArea || !driver.deliveryAreas?.length || driver.deliveryAreas.some((a: any) => a._id === order.deliveryArea?._id);
                                            return (
                                              <button
                                                key={driver._id}
                                                onClick={() => assignDriver(order._id, driver._id)}
                                                className={`w-full text-left rtl:text-right px-4 py-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between ${!canServe ? 'opacity-50 grayscale' : ''}`}
                                              >
                                                <div>
                                                  <p className="text-sm font-bold text-slate-800">{getDriverDisplayNameForBusiness(driver)}</p>
                                                  <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`w-2 h-2 rounded-full ${driver.isOnline ? 'bg-green-500' : 'bg-slate-300'}`} />
                                                    <span className="text-xs text-slate-500">{driver.isOnline ? 'Online' : 'Offline'}</span>
                                                  </div>
                                                </div>
                                                <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                                                  {t('Assign', 'تعيين')}
                                                </div>
                                              </button>
                                            )
                                          })
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Table View Card Footer */}
                    <div className="bg-slate-50 border-t border-slate-100 text-center py-2 text-xs font-bold text-slate-500 group-hover:bg-slate-100 transition-colors">
                      {t('Open Full Card', 'فتح البطاقة كاملة')}
                    </div>
                  </div>
                );
              })}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders.map((order) => {
                  const hasTableRequest = order.orderType === 'dine-in' && order.customerRequestedAt && !order.customerRequestAcknowledgedAt
                  // Only skip 'new' status if we are in live tab and it's not a table request
                  if (activeTab === 'live' && order.status === 'new' && !hasTableRequest) return null;

                  const deliveryOnlyStatuses = ['waiting_for_delivery', 'driver_on_the_way', 'out-for-delivery']
                  const isDeliveryOrder = order.orderType === 'delivery'
                  const effectiveStatus = (!isDeliveryOrder && deliveryOnlyStatuses.includes(order.status)) ? 'preparing' : order.status
                  const statusConfig = STATUS_CONFIG[effectiveStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.new;
                  const StatusIcon = statusConfig.icon;
                  const orderTime = new Date(order.createdAt).toLocaleString();

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      key={order._id}
                      className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-slate-200 text-slate-900 flex flex-col cursor-pointer overflow-hidden group"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="p-6 flex flex-col flex-1">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                              className="text-xl font-black mb-1 text-slate-900 text-left hover:text-blue-600 transition-colors"
                            >
                              Order #{order.orderNumber.slice(-4)}
                            </button>
                            <p className="text-sm text-slate-500">{orderTime}</p>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setStatusModalOrder(order); }}
                            className={`${statusConfig.color} text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-transform hover:scale-105 active:scale-95`}
                          >
                            <StatusIcon className="w-4 h-4" />
                            <span className="font-bold text-sm">{lang === 'ar' ? statusConfig.labelAr : statusConfig.label}</span>
                            <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
                          </button>
                        </div>

                        <div className="space-y-4 mb-4 flex-1">
                          {activeTab === 'scheduled' && order.scheduledFor && (
                            <div className="mb-6 flex flex-col items-center justify-center p-6 bg-purple-50 rounded-2xl border-2 border-purple-200 shadow-sm relative overflow-hidden">
                              <div className="absolute top-0 right-0 -mr-6 -mt-6 opacity-5 pointer-events-none">
                                <Clock className="w-32 h-32 text-purple-600" />
                              </div>
                              
                              <div className="z-10 flex flex-col items-center text-center space-y-2">
                                <span className="text-sm font-bold text-purple-600 uppercase tracking-widest">
                                  {t('Scheduled For', 'مجدول ليوم')}
                                </span>
                                <div className="text-4xl md:text-5xl font-black text-purple-900 tracking-tight" dir="ltr">
                                  {new Date(order.scheduledFor).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="text-sm font-bold text-purple-700">
                                  {new Date(order.scheduledFor).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                </div>
                              </div>
                            </div>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); setCustomerModalOrder(order); }}
                            className="flex flex-col items-center justify-center w-full bg-slate-50 hover:bg-slate-100 rounded-xl px-4 py-3 transition-colors border border-slate-100"
                          >
                            <span className="font-bold text-slate-800 text-base">{order.customerName}</span>
                            {order.customerPhone && (
                              <span className="text-sm text-slate-500 font-mono mt-0.5" dir="ltr">{order.customerPhone}</span>
                            )}
                          </button>

                          {order.orderType === 'dine-in' && order.tableNumber && (
                            <p className="text-sm text-slate-600">{t('Table', 'طاولة')}: {order.tableNumber}</p>
                          )}
                          {order.orderType === 'dine-in' && order.customerRequestedAt && !order.customerRequestAcknowledgedAt && (
                            <p className="text-sm font-semibold text-amber-600">
                              {order.customerRequestType === 'request_check'
                                ? t('Wants to pay', 'يريد الدفع') + (order.customerRequestPaymentMethod === 'cash' ? ` (${t('Cash', 'نقداً')})` : ` (${t('Card', 'بطاقة')})`)
                                : t('Needs help', 'يحتاج مساعدة')}
                            </p>
                          )}
                          {isDeliveryOrder && (
                            <>
                              {order.deliveryArea && (
                                <p className="text-sm text-slate-600">Area: {order.deliveryArea.name_en}</p>
                              )}
                              
                              {!['cancelled', 'refunded'].includes(order.status) && (
                                <div className="relative">
                                  {order.assignedDriver ? (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setDriverModalOrder(order); }}
                                      className="flex items-center gap-1.5 px-3 py-2 w-full justify-center rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 text-sm font-bold transition-colors"
                                    >
                                      <Truck className="w-4 h-4" />
                                      {getDriverDisplayNameForBusiness(order.assignedDriver)}
                                      <ChevronDown className="w-4 h-4 opacity-70 ml-1" />
                                    </button>
                                  ) : (
                                    <>
                                      {showAutoDeliveryRow(order, tenantSlug) && tenantSlug && (
                                        <div className="mb-3 w-full" onClick={(e) => e.stopPropagation()}>
                                          <AutoDeliveryRequestControls
                                            tenantSlug={tenantSlug}
                                            orderId={order._id}
                                            deliveryRequestedAt={order.deliveryRequestedAt}
                                            autoDeliveryRequestMinutes={order.autoDeliveryRequestMinutes}
                                            autoDeliveryRequestScheduledAt={order.autoDeliveryRequestScheduledAt}
                                            tenantDefaults={autoDeliveryDefaults}
                                            emphasize={order.status === 'new'}
                                            onPatched={(p) => applyAutoDeliveryPatch(order._id, p)}
                                          />
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); requestDelivery(order._id); }}
                                          className="flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 w-full rounded-xl bg-blue-100 text-blue-700 hover:bg-blue-200 active:scale-[0.97] active:bg-blue-300 text-base font-bold transition-all duration-150 ease-out shadow-md border border-blue-200/50 touch-manipulation"
                                        >
                                          <Truck className="w-5 h-5 shrink-0" />
                                          {t('Request Delivery', 'طلب توصيل')}
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setAssignDropdownOrder(assignDropdownOrder === order._id ? null : order._id); }}
                                          className="flex items-center justify-center px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200 shadow-sm shrink-0"
                                        >
                                          <ChevronDown className="w-5 h-5 opacity-70" />
                                        </button>
                                      </div>
                                      
                                      <AnimatePresence>
                                        {assignDropdownOrder === order._id && (
                                          <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-slate-200 z-40 overflow-hidden"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <div className="p-3 border-b border-slate-100 bg-slate-50">
                                              <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                  type="checkbox" 
                                                  checked={showOfflineDrivers}
                                                  onChange={(e) => setShowOfflineDrivers(e.target.checked)}
                                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-xs font-medium text-slate-600">
                                                  {t('Show offline drivers', 'إظهار السائقين غير المتصلين')}
                                                </span>
                                              </label>
                                            </div>
                                            <div className="max-h-60 overflow-y-auto">
                                              {loadingDrivers ? (
                                                <p className="p-4 text-center text-xs text-slate-400">Loading...</p>
                                              ) : drivers.filter(d => showOfflineDrivers || d.isOnline).length === 0 ? (
                                                <p className="p-4 text-center text-xs text-slate-400">
                                                  {t('No drivers available.', 'لا يوجد سائقين متاحين.')}
                                                </p>
                                              ) : (
                                                drivers.filter(d => showOfflineDrivers || d.isOnline).map(driver => {
                                                  const canServe = !order.deliveryArea || !driver.deliveryAreas?.length || driver.deliveryAreas.some((a: any) => a._id === order.deliveryArea?._id);
                                                  return (
                                                    <button
                                                      key={driver._id}
                                                      onClick={() => assignDriver(order._id, driver._id)}
                                                      className={`w-full text-left rtl:text-right px-4 py-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between ${!canServe ? 'opacity-50 grayscale' : ''}`}
                                                    >
                                                      <div>
                                                        <p className="text-sm font-bold text-slate-800">{getDriverDisplayNameForBusiness(driver)}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                          <span className={`w-2 h-2 rounded-full ${driver.isOnline ? 'bg-green-500' : 'bg-slate-300'}`} />
                                                          <span className="text-xs text-slate-500">{driver.isOnline ? 'Online' : 'Offline'}</span>
                                                        </div>
                                                      </div>
                                                      <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                                                        {t('Assign', 'تعيين')}
                                                      </div>
                                                    </button>
                                                  )
                                                })
                                              )}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                          <p className="text-lg font-black text-slate-900 mt-2">
                            {order.totalAmount.toFixed(2)} {order.currency}
                          </p>
                        </div>

                        {order.scheduledFor && (
                          <div className={`mb-4 bg-purple-600 text-white px-4 py-3 rounded-xl shadow-md text-sm font-bold flex items-center justify-between gap-3 relative overflow-hidden ${['completed', 'cancelled', 'refunded'].includes(order.status) ? 'opacity-30' : ''}`}>
                            <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-10 pointer-events-none">
                              <Clock className="w-20 h-20" />
                            </div>
                            <div className="flex items-center gap-2 z-10">
                              <Clock className="w-5 h-5 shrink-0" />
                              <span>
                                {t('Scheduled for:', 'مجدول ليوم:')} {new Date(order.scheduledFor).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                            </div>
                            {order.status === 'acknowledged' && (
                              <span className="z-10 bg-white/20 px-2 py-1 rounded-md text-xs whitespace-nowrap">
                                {t('Accepted', 'مقبول')}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs text-slate-500 mt-auto pt-4 border-t border-slate-100">
                          <span>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
                          <span className={order.orderType === 'delivery' ? 'text-red-600 font-medium' : ''}>
                            {order.orderType === 'receive-in-person'
                              ? t('Receive in Person', 'استلام شخصي')
                              : order.orderType === 'dine-in'
                                ? '🍽️ ' + t('Dine-in', 'تناول هنا')
                                : '🚗 ' + t('Delivery', 'توصيل')}
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-50 border-t border-slate-100 text-center py-2.5 text-xs font-bold text-slate-500 group-hover:bg-slate-100 transition-colors w-full">
                        {t('Open Full Card', 'فتح البطاقة كاملة')}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {selectedOrder && (selectedOrder.status !== 'new' || (selectedOrder.customerRequestedAt && !selectedOrder.customerRequestAcknowledgedAt)) && (
          <OrderDetailsModal
            order={selectedOrder as Omit<Order, 'status'> & { status: Order['status'] }}
            onClose={() => setSelectedOrder(null)}
            onStatusUpdate={async (orderId, status, notifyAt, newScheduledFor) => {
              await updateOrderStatus(orderId, status, notifyAt, newScheduledFor);
              setSelectedOrder(null);
            }}
            onRefresh={() => { }}
            onOrderUpdated={(updatedOrder) => {
              setOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o))
              setSelectedOrder(prev => prev && prev._id === updatedOrder._id ? updatedOrder : prev)
            }}
            tenantSlug={tenantSlug}
            autoDeliveryDefaults={autoDeliveryDefaults}
            onAcknowledgeTableRequest={onAcknowledgeTableRequest}
          />
        )}

        {/* Customer Info Modal */}
        <AnimatePresence>
          {customerModalOrder && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
              onClick={() => setCustomerModalOrder(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
              >
                <div className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <UserMinus className="h-8 w-8" style={{ display: 'none' }} /> {/* Re-using icon just for structure, will replace */}
                    <div className="text-2xl font-black">{customerModalOrder.customerName.charAt(0).toUpperCase()}</div>
                  </div>
                  <h3 className="mb-1 text-2xl font-black text-slate-900">{customerModalOrder.customerName}</h3>
                  {customerModalOrder.customerPhone && <p className="mb-6 text-slate-500 font-mono" dir="ltr">{customerModalOrder.customerPhone}</p>}
                  
                  <div className="flex flex-col gap-3">
                    {customerModalOrder.customerPhone && (
                      <>
                        <a href={`tel:${customerModalOrder.customerPhone}`} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 font-bold text-white transition-colors hover:bg-blue-700">
                          <Phone className="h-5 w-5" />
                          {t('Call Customer', 'اتصال بالعميل')}
                        </a>
                        <a href={`https://wa.me/${customerModalOrder.customerPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 font-bold text-white transition-colors hover:bg-[#20bd5a]">
                          <MessageCircle className="h-5 w-5" />
                          {t('WhatsApp Customer', 'واتساب العميل')}
                        </a>
                      </>
                    )}
                    <button onClick={() => setCustomerModalOrder(null)} className="mt-2 w-full rounded-xl py-3 font-bold text-slate-500 hover:bg-slate-100">
                      {t('Close', 'إغلاق')}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Status Modal */}
        <AnimatePresence>
          {statusModalOrder && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-0"
              onClick={() => setStatusModalOrder(null)}
            >
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl pb-safe"
              >
                <div className="p-6">
                  <h3 className="mb-4 text-xl font-black text-slate-900 text-center">{t('Update Status', 'تحديث الحالة')}</h3>
                  <div className="flex flex-col gap-2">
                    {Object.entries(STATUS_CONFIG).map(([statusKey, config]) => {
                      if (statusKey === 'new') return null; // Usually don't revert to new manually
                      const isCurrent = statusModalOrder.status === statusKey;
                      const Icon = config.icon;
                      return (
                        <button
                          key={statusKey}
                          onClick={() => {
                            if (!isCurrent) updateOrderStatus(statusModalOrder._id, statusKey);
                            setStatusModalOrder(null);
                          }}
                          className={`flex items-center gap-3 rounded-xl p-4 transition-colors ${
                            isCurrent ? `${config.color} text-white` : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="font-bold text-sm flex-1 text-left rtl:text-right">
                            {lang === 'ar' ? config.labelAr : config.label}
                          </span>
                          {isCurrent && <CheckCircle2 className="h-5 w-5 opacity-50" />}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => setStatusModalOrder(null)} className="mt-4 w-full rounded-xl py-3 font-bold text-slate-500 hover:bg-slate-100">
                    {t('Cancel', 'إلغاء')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Driver Action Modal */}
        <AnimatePresence>
          {driverModalOrder && driverModalOrder.assignedDriver && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
              onClick={() => setDriverModalOrder(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
              >
                <div className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                    <Truck className="h-8 w-8" />
                  </div>
                  <h3 className="mb-1 text-2xl font-black text-slate-900">{getDriverDisplayNameForBusiness(driverModalOrder.assignedDriver)}</h3>
                  {driverModalOrder.assignedDriver.phoneNumber && <p className="mb-6 text-slate-500 font-mono" dir="ltr">{driverModalOrder.assignedDriver.phoneNumber}</p>}
                  
                  <div className="flex flex-col gap-3">
                    {driverModalOrder.assignedDriver.phoneNumber && (
                      <>
                        <a href={`tel:${driverModalOrder.assignedDriver.phoneNumber}`} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 font-bold text-white transition-colors hover:bg-orange-600">
                          <Phone className="h-5 w-5" />
                          {t('Call Driver', 'اتصال بالسائق')}
                        </a>
                        <a href={`https://wa.me/${driverModalOrder.assignedDriver.phoneNumber.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 font-bold text-white transition-colors hover:bg-[#20bd5a]">
                          <MessageCircle className="h-5 w-5" />
                          {t('WhatsApp Driver', 'واتساب السائق')}
                        </a>
                      </>
                    )}
                    <div className="h-px w-full bg-slate-100 my-2" />
                    <button 
                      onClick={() => unassignDriver(driverModalOrder._id)} 
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3.5 font-bold text-red-600 transition-colors hover:bg-red-100"
                    >
                      <UserMinus className="h-5 w-5" />
                      {t('Unassign Driver', 'إلغاء تعيين السائق')}
                    </button>
                    <button onClick={() => setDriverModalOrder(null)} className="mt-2 w-full rounded-xl py-3 font-bold text-slate-500 hover:bg-slate-100">
                      {t('Close', 'إغلاق')}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </>
  )

  if (skipProtection) return content
  return <AdminProtection pageName="Orders Management">{content}</AdminProtection>
}
