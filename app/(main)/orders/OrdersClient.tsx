'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Package, Truck, UtensilsCrossed, Store, Clock, CheckCircle2, XCircle, ChefHat, Search, ChevronDown, ChevronUp, Filter, LayoutGrid, List, Undo2, Settings } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { AdminProtection } from '@/components/Auth/AdminProtection'
import { OrderDetailsModal } from '@/components/Orders/OrderDetailsModal'
import { OrderNotifications } from '@/components/Orders/OrderNotifications'
import { Input } from '@/components/ui/input'
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
  assignedDriver?: {
    _id: string
    name: string
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
}

export function OrdersClient({ initialOrders, tenantSlug, skipProtection, openOrderIdForTableRequest, onAcknowledgeTableRequest, onModalOpenChange }: OrdersClientProps) {
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
        setHiddenStatuses(JSON.parse(storedStatuses))
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
    if (order) setSelectedOrder(order)
  }, [openOrderIdForTableRequest, orders])

  // Notify parent when modal opens/closes so the red-bell dialog can be hidden and modal is clickable
  useEffect(() => {
    onModalOpenChange?.(selectedOrder != null)
  }, [selectedOrder, onModalOpenChange])

  // Set default to today's date for initial load
  useEffect(() => {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    setStartDate(todayString);
    setEndDate(todayString);
  }, []);

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
        throw new Error(responseData.error || `Failed to update order status: ${response.status} ${response.statusText}`);
      }

      if (!responseData.success) {
        throw new Error('Update did not return success');
      }

      setTimeout(() => {
        isUpdatingStatusRef.current = false;
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
      const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
      if (orderDate < startDate || orderDate > endDate) return false;
    } else if (startDate) {
      const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
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
              <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-sm font-semibold text-slate-500">
                      <th className="py-3 px-4">{t('Order #', 'الطلب #')}</th>
                      <th className="py-3 px-4">{t('Time', 'الوقت')}</th>
                      <th className="py-3 px-4">{t('Customer', 'العميل')}</th>
                      <th className="py-3 px-4">{t('Type', 'النوع')}</th>
                      <th className="py-3 px-4">{t('Status', 'الحالة')}</th>
                      <th className="py-3 px-4">{t('Total', 'المجموع')}</th>
                      <th className="py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => {
                      const deliveryOnlyStatuses = ['waiting_for_delivery', 'driver_on_the_way', 'out-for-delivery']
                      const isDeliveryOrder = order.orderType === 'delivery'
                      const effectiveStatus = (!isDeliveryOrder && deliveryOnlyStatuses.includes(order.status)) ? 'preparing' : order.status
                      const statusConfig = STATUS_CONFIG[effectiveStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.new;
                      const StatusIcon = statusConfig.icon;
                      const orderTime = new Date(order.createdAt).toLocaleString();

                      return (
                        <tr 
                          key={order._id} 
                          className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <td className="py-4 px-4 font-black text-slate-900">#{order.orderNumber}</td>
                          <td className="py-4 px-4 text-sm text-slate-500">
                            {orderTime}
                            {order.scheduledFor && (
                              <div className="text-xs font-bold text-purple-600 mt-1">
                                {t('Scheduled:', 'مجدول:')} {new Date(order.scheduledFor).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <p className="font-semibold text-slate-900">{order.customerName}</p>
                            {order.customerPhone && <p className="text-xs text-slate-500">{order.customerPhone}</p>}
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm text-slate-600">
                              {order.orderType === 'receive-in-person'
                                ? t('Receive in Person', 'استلام شخصي')
                                : order.orderType === 'dine-in'
                                  ? t('Dine-in', 'تناول هنا')
                                  : t('Delivery', 'توصيل')}
                            </span>
                            {order.orderType === 'dine-in' && order.tableNumber && (
                              <span className="block text-xs font-bold text-slate-500 mt-1">T: {order.tableNumber}</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-sm ${statusConfig.color}`}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {lang === 'ar' ? statusConfig.labelAr : statusConfig.label}
                            </div>
                          </td>
                          <td className="py-4 px-4 font-black text-slate-900">
                            {order.totalAmount.toFixed(2)} <span className="text-xs text-slate-500">{order.currency}</span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-semibold">
                              {t('View', 'عرض')}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                      className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-slate-400 text-slate-900"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-black mb-1 text-slate-900">Order #{order.orderNumber}</h3>
                          <p className="text-sm text-slate-500">{orderTime}</p>
                        </div>
                        <div className={`${statusConfig.color} text-white px-3 py-1 rounded-lg flex items-center gap-1`}>
                          <StatusIcon className="w-4 h-4" />
                          <span className="font-bold text-sm">{lang === 'ar' ? statusConfig.labelAr : statusConfig.label}</span>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <p className="font-semibold text-slate-900">{order.customerName}</p>
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
                        {order.orderType === 'delivery' && (
                          <>
                            {order.customerPhone && (
                              <p className="text-sm text-slate-600">Phone: {order.customerPhone}</p>
                            )}
                            {order.deliveryArea && (
                              <p className="text-sm text-slate-600">Area: {order.deliveryArea.name_en}</p>
                            )}
                            {order.assignedDriver && (
                              <p className="text-sm text-orange-600 font-semibold">Driver: {order.assignedDriver.name}</p>
                            )}
                          </>
                        )}
                        <p className="text-lg font-black text-slate-900">
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

                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
                        <span className={order.orderType === 'delivery' ? 'text-red-600 font-medium' : ''}>
                          {order.orderType === 'receive-in-person'
                            ? t('Receive in Person', 'استلام شخصي')
                            : order.orderType === 'dine-in'
                              ? '🍽️ ' + t('Dine-in', 'تناول هنا')
                              : '🚗 ' + t('Delivery', 'توصيل')}
                        </span>
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
            onStatusUpdate={async (orderId, status) => {
              await updateOrderStatus(orderId, status);
              setSelectedOrder(null);
            }}
            onRefresh={() => { }}
            onOrderUpdated={(updatedOrder) => {
              setOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o))
              setSelectedOrder(prev => prev && prev._id === updatedOrder._id ? updatedOrder : prev)
            }}
            tenantSlug={tenantSlug}
            onAcknowledgeTableRequest={onAcknowledgeTableRequest}
          />
        )}
      </div>
    </>
  )

  if (skipProtection) return content
  return <AdminProtection pageName="Orders Management">{content}</AdminProtection>
}
