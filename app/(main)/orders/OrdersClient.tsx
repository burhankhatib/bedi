'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Package, Truck, UtensilsCrossed, Store, Clock, CheckCircle2, XCircle, ChefHat, Search, ChevronDown, ChevronUp, Filter } from 'lucide-react'
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
  status: 'new' | 'preparing' | 'waiting_for_delivery' | 'driver_on_the_way' | 'out-for-delivery' | 'completed' | 'served' | 'cancelled' | 'refunded'
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
  completedAt?: string
  customerRequestType?: 'call_waiter' | 'request_check'
  customerRequestPaymentMethod?: 'cash' | 'card'
  customerRequestedAt?: string
  customerRequestAcknowledgedAt?: string
  tipPercent?: number
  tipAmount?: number
}

const STATUS_CONFIG = {
  new: { label: 'New', labelAr: 'جديد', icon: Package, color: 'bg-blue-500', textColor: 'text-blue-600' },
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
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const isUpdatingStatusRef = useRef(false)

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

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    isUpdatingStatusRef.current = true;

    try {
      // Optimistically update the order in local state immediately
      setOrders(prevOrders => {
        return prevOrders.map(order => {
          if (order._id === orderId) {
            const updatedOrder = {
              ...order,
              status: newStatus as Order['status'],
            };
            if (newStatus === 'completed') {
              updatedOrder.completedAt = new Date().toISOString();
            }
            return updatedOrder;
          }
          return order;
        });
      });

      const payload: { orderId: string; status: string; completedAt?: string } = {
        orderId,
        status: newStatus,
      };

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
        console.error('API error response:', {
          status: response.status,
          statusText: response.statusText,
          data: responseData
        });
        throw new Error(responseData.error || `Failed to update order status: ${response.status} ${response.statusText}`);
      }

      console.log('Order status updated successfully:', responseData);

      if (!responseData.success) {
        throw new Error('Update did not return success');
      }

      // Clear flag after a delay to allow SanityLive to update
      setTimeout(() => {
        isUpdatingStatusRef.current = false;
      }, 1000);

      setSelectedOrder(null);
    } catch (error) {
      console.error('Failed to update order status:', error);
      isUpdatingStatusRef.current = false;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Full error details:', error);

      // Revert optimistic update by using initialOrders
      setOrders(initialOrders);

      alert(`Failed to update order status:\n\n${errorMessage}\n\nPlease check the browser console for more details.`);
    }
  };

  // Client-side filtering
  const filteredOrders = (orders || []).filter(order => {
    // Exclude "new" status orders (they're handled by notifications)
    if (order.status === 'new') return false;

    // Date filtering (only if dates are set, otherwise show all)
    if (startDate && endDate) {
      const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
      if (orderDate < startDate || orderDate > endDate) return false;
    } else if (startDate) {
      const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
      if (orderDate !== startDate) return false;
    }

    // Status filter
    if (filterStatus !== 'all' && order.status !== filterStatus) return false;

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
        <div className="max-w-7xl mx-auto">
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
                        <span className="text-sm font-semibold text-slate-600 mb-2 block">Status:</span>
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar -mx-2 px-2">
                          <div className="flex gap-2 min-w-max">
                            <Button
                              onClick={() => setFilterStatus('all')}
                              variant={filterStatus === 'all' ? 'default' : 'outline'}
                              size="sm"
                              className="rounded-lg shrink-0"
                            >
                              All Status
                            </Button>
                            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                              <Button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                variant={filterStatus === status ? 'default' : 'outline'}
                                size="sm"
                                className="rounded-lg shrink-0"
                              >
                                <config.icon className="w-4 h-4 mr-1" />
                                {lang === 'ar' ? config.labelAr : config.label}
                              </Button>
                            ))}
                          </div>
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

          {/* Orders Grid */}
          <div className="bg-white rounded-3xl shadow-lg p-6">
            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-lg p-8 md:p-12 text-center">
                <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-400 mb-2">{t('No orders found', 'لا توجد طلبات')}</h3>
                <p className="text-slate-400">{t('Try adjusting your filters', 'جرّب تعديل الفلاتر')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders.map((order) => {
                  const hasTableRequest = order.orderType === 'dine-in' && order.customerRequestedAt && !order.customerRequestAcknowledgedAt
                  if (order.status === 'new' && !hasTableRequest) return null;

                  const deliveryOnlyStatuses = ['waiting_for_delivery', 'driver_on_the_way', 'out-for-delivery']
                  const isDeliveryOrder = order.orderType === 'delivery'
                  const effectiveStatus = (!isDeliveryOrder && deliveryOnlyStatuses.includes(order.status)) ? 'preparing' : order.status
                  const statusConfig = STATUS_CONFIG[effectiveStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.new;
                  const StatusIcon = statusConfig.icon;
                  const orderTime = new Date(order.createdAt).toLocaleString();

                  return (
                    <div
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
                    </div>
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
