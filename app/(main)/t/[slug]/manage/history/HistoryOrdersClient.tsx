'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Package, Search, ChefHat, Clock, CheckCircle2, XCircle, Truck, UtensilsCrossed, Store, HandHelping } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { getDriverDisplayNameForBusiness } from '@/lib/driver-display'
import { Input } from '@/components/ui/input'
import { OrderDetailsModal } from '@/components/Orders/OrderDetailsModal'
import type { Order } from '@/app/(main)/orders/OrdersClient'

interface TableRequestHistory {
  _id: string
  tableNumber: string
  type: string
  createdAt: string
  acknowledgedAt: string
}

type HistoryItem = 
  | { type: 'order'; data: Order; sortDate: string }
  | { type: 'tableRequest'; data: TableRequestHistory; sortDate: string }

const STATUS_CONFIG: Record<string, { label: string; labelAr: string; icon: typeof ChefHat; color: string }> = {
  new: { label: 'New', labelAr: 'جديد', icon: Package, color: 'bg-slate-500' },
  preparing: { label: 'Preparing', labelAr: 'قيد التحضير', icon: ChefHat, color: 'bg-orange-500' },
  waiting_for_delivery: { label: 'Waiting for Delivery', labelAr: 'في انتظار التوصيل', icon: Clock, color: 'bg-amber-500' },
  driver_on_the_way: { label: 'Driver on the way', labelAr: 'السائق في الطريق', icon: Truck, color: 'bg-blue-500' },
  'out-for-delivery': { label: 'Out for delivery', labelAr: 'في الطريق إليك', icon: Truck, color: 'bg-purple-500' },
  completed: { label: 'Completed', labelAr: 'مكتمل', icon: CheckCircle2, color: 'bg-green-500' },
  cancelled: { label: 'Cancelled', labelAr: 'ملغي', icon: XCircle, color: 'bg-red-500' },
  refunded: { label: 'Refunded', labelAr: 'مسترد', icon: XCircle, color: 'bg-amber-600' },
  driver_cancelled: { label: 'Driver cancelled delivery', labelAr: 'السائق ألغى التوصيل', icon: XCircle, color: 'bg-amber-500' },
}

export function HistoryOrdersClient({ slug }: { slug: string }) {
  const { t } = useLanguage()
  const [orders, setOrders] = useState<Order[]>([])
  const [tableRequests, setTableRequests] = useState<TableRequestHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const url = `/api/tenants/${slug}/orders/history${debouncedSearch ? `?q=${encodeURIComponent(debouncedSearch)}` : ''}`
      const res = await fetch(url, { cache: 'default' })
      const data = await res.json()
      setOrders(Array.isArray(data?.orders) ? data.orders : [])
      setTableRequests(Array.isArray(data?.tableRequests) ? data.tableRequests : [])
    } catch {
      setOrders([])
      setTableRequests([])
    } finally {
      setLoading(false)
    }
  }, [slug, debouncedSearch])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const statusConfig = (order: Order) => {
    if (order.orderType === 'delivery' && order.driverCancelledAt) {
      return STATUS_CONFIG['driver_cancelled'] ?? STATUS_CONFIG[order.status] ?? { label: order.status, labelAr: order.status, icon: Package, color: 'bg-slate-500' }
    }
    return STATUS_CONFIG[order.status] ?? { label: order.status, labelAr: order.status, icon: Package, color: 'bg-slate-500' }
  }

  const historyItems = useMemo(() => {
    const items: HistoryItem[] = [
      ...orders.map(o => ({ type: 'order' as const, data: o, sortDate: o.completedAt || o.driverCancelledAt || o.cancelledAt || o.createdAt })),
      ...tableRequests.map(r => ({ type: 'tableRequest' as const, data: r, sortDate: r.acknowledgedAt || r.createdAt }))
    ]
    return items.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
  }, [orders, tableRequests])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-white mb-1">
          {t('Order History', 'سجل الطلبات')}
        </h1>
        <p className="text-slate-400 text-sm">
          {t('Search by order number, customer name, or phone', 'ابحث برقم الطلب أو اسم العميل أو رقم الهاتف')}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          type="text"
          placeholder={t('Search orders…', 'ابحث في الطلبات…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 pr-4 py-3 rounded-xl border-slate-700 bg-slate-800/60 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {loading ? (
        <p className="text-slate-400">{t('Loading…', 'جاري التحميل…')}</p>
      ) : historyItems.length === 0 ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-12 text-center">
          <Package className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-400 mb-2">
            {t('No history found', 'لا يوجد سجل')}
          </h3>
          <p className="text-slate-500">
            {debouncedSearch
              ? t('Try a different search term', 'جرّب كلمة بحث أخرى')
              : t('History will appear here', 'سيظهر السجل هنا')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {historyItems.map((item) => {
            if (item.type === 'tableRequest') {
              const req = item.data
              const reqTime = new Date(req.createdAt).toLocaleString()
              return (
                <div
                  key={`tr-${req._id}`}
                  className="text-left w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-black text-white">{t('Table', 'طاولة')} {req.tableNumber}</h3>
                      <p className="text-sm text-slate-500">{reqTime}</p>
                    </div>
                    <span className="bg-amber-500 text-white px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-semibold">
                      <HandHelping className="w-3.5 h-3.5" />
                      {t('Waiter Help', 'طلب مساعدة')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">
                    {t('Acknowledged at', 'تم الاستجابة في')}: {new Date(req.acknowledgedAt).toLocaleString()}
                  </p>
                </div>
              )
            }

            const order = item.data
            const config = statusConfig(order)
            const StatusIcon = config.icon
            const orderTime = new Date(order.createdAt).toLocaleString()

            return (
              <button
                key={`o-${order._id}`}
                type="button"
                className="text-left w-full rounded-2xl border border-slate-700 bg-slate-800/60 p-5 hover:border-slate-600 hover:bg-slate-800/80 transition-colors"
                onClick={() => order.status !== 'new' && setSelectedOrder(order)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-black text-white">#{order.orderNumber}</h3>
                    <p className="text-sm text-slate-500">{orderTime}</p>
                  </div>
                  <span className={`${config.color} text-white px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-semibold`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {t(config.label, config.labelAr)}
                  </span>
                </div>
                <p className="font-semibold text-white">{order.customerName}</p>
                {order.orderType === 'dine-in' && order.tableNumber && (
                  <p className="text-sm text-slate-400">{t('Table', 'طاولة')}: {order.tableNumber}</p>
                )}
                {order.orderType === 'delivery' && (
                  <>
                    {order.customerPhone && (
                      <p className="text-sm text-slate-400">{order.customerPhone}</p>
                    )}
                    {order.assignedDriver && (
                      <p className="text-sm text-amber-400 font-medium">{getDriverDisplayNameForBusiness(order.assignedDriver)}</p>
                    )}
                  </>
                )}
                <p className="text-base font-black text-white mt-2">
                  {order.totalAmount.toFixed(2)} {order.currency}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                  <span>{order.items?.length ?? 0} {t('items', 'أصناف')}</span>
                  <span>
                    {order.orderType === 'receive-in-person'
                      ? t('Pickup', 'استلام')
                      : order.orderType === 'dine-in'
                        ? t('Dine-in', 'تناول هنا')
                        : t('Delivery', 'توصيل')}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selectedOrder && selectedOrder.status !== 'new' && (
        <OrderDetailsModal
          order={selectedOrder as Omit<Order, 'status'> & { status: Exclude<Order['status'], 'new'> }}
          onClose={() => setSelectedOrder(null)}
          onStatusUpdate={async () => {}}
          onRefresh={fetchHistory}
          onOrderUpdated={(updated) => {
            setOrders((prev) => prev.map((o) => (o._id === updated._id ? updated : o)))
            setSelectedOrder((prev) => (prev && prev._id === updated._id ? updated : prev))
          }}
          tenantSlug={slug}
        />
      )}
    </div>
  )
}
