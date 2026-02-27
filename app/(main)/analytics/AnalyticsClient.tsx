'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TrendingUp, Package, DollarSign, Users, Star, Truck, UtensilsCrossed, Store, Calendar, Award, BarChart3 } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { formatCurrency } from '@/lib/currency'
import { AdminProtection } from '@/components/Auth/AdminProtection'

interface OrderStats {
  totalOrders: number
  totalRevenue: number
  averageOrderValue: number
  totalCustomers: number
  receiveInPersonOrders: number
  dineInOrders: number
  deliveryOrders: number
  completedOrders: number
  cancelledOrders: number
  refundedOrders: number
  averageDeliveryFee: number
}

interface PopularProduct {
  productName: string
  totalQuantity: number
  totalRevenue: number
  orderCount: number
}

interface RevenueByArea {
  areaName: string
  orderCount: number
  totalRevenue: number
}

interface Order {
  _id: string
  orderNumber: string
  orderType: string
  status: string
  customerName: string
  items: Array<{
    productName: string
    quantity: number
    total: number
  }>
  totalAmount: number
  deliveryFee?: number
  currency: string
  createdAt: string
  deliveryArea?: {
    name_en: string
  }
  assignedDriver?: { _id: string; name?: string }
}

interface TopDriver {
  driverName: string
  completedDeliveries: number
}

interface AnalyticsClientProps {
  initialOrders: Order[]
  /** When false, do not wrap with AdminProtection (e.g. tenant dashboard) */
  wrapWithAdmin?: boolean
  /** Page title (default: "Analytics Dashboard") */
  title?: string
  /** Subtitle below title */
  subtitle?: string
  /** Tenant dashboard: business-focused cards, default Today, top drivers, no delivery "revenue" */
  variant?: 'tenant'
}

export function AnalyticsClient({
  initialOrders,
  wrapWithAdmin = true,
  title = 'Analytics Dashboard',
  subtitle = 'Business insights and performance metrics',
  variant,
}: AnalyticsClientProps) {
  const { t } = useLanguage()
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [popularProducts, setPopularProducts] = useState<PopularProduct[]>([])
  const [revenueByArea, setRevenueByArea] = useState<RevenueByArea[]>([])
  const [topDrivers, setTopDrivers] = useState<TopDriver[]>([])
  const [ordersByHour, setOrdersByHour] = useState<Array<{ hour: number; count: number }>>([])
  const [ordersByDay, setOrdersByDay] = useState<Array<{ day: number; label: string; count: number }>>([])
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('today')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Update orders when initialOrders changes (from SanityLive)
  useEffect(() => {
    setOrders(initialOrders)
  }, [initialOrders])

  const calculateStats = useCallback((ordersToCalculate: Order[]) => {
    // Filter out cancelled and refunded orders from revenue calculations
    const activeOrders = ordersToCalculate.filter(o => o.status !== 'cancelled' && o.status !== 'refunded')

    // Apply date filtering
    let filteredOrders = ordersToCalculate
    const now = new Date()

    if (startDate && endDate) {
      const start = new Date(startDate + 'T00:00:00')
      const end = new Date(endDate + 'T23:59:59')
      filteredOrders = filteredOrders.filter(o => {
        const orderDate = new Date(o.createdAt)
        return orderDate >= start && orderDate <= end
      })
    } else if (dateRange === 'today') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0))
      filteredOrders = filteredOrders.filter(o => new Date(o.createdAt) >= startOfDay)
    } else if (dateRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      filteredOrders = filteredOrders.filter(o => new Date(o.createdAt) >= weekAgo)
    } else if (dateRange === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      filteredOrders = filteredOrders.filter(o => new Date(o.createdAt) >= monthAgo)
    }

    const activeFilteredOrders = filteredOrders.filter(o => o.status !== 'cancelled' && o.status !== 'refunded')

    // Basic stats
    const totalOrders = filteredOrders.length
    const totalRevenue = activeFilteredOrders.reduce((sum, order) => sum + order.totalAmount, 0)
    const averageOrderValue = activeFilteredOrders.length > 0 ? totalRevenue / activeFilteredOrders.length : 0

    // Unique customers
    const uniqueCustomers = new Set(activeFilteredOrders.map(o => o.customerName.toLowerCase())).size

    // Order types
    const receiveInPersonOrders = filteredOrders.filter(o => o.orderType === 'receive-in-person').length
    const dineInOrders = filteredOrders.filter(o => o.orderType === 'dine-in').length
    const deliveryOrders = filteredOrders.filter(o => o.orderType === 'delivery').length

    // Status
    const completedOrders = filteredOrders.filter(o => o.status === 'completed').length
    const cancelledOrders = filteredOrders.filter(o => o.status === 'cancelled').length
    const refundedOrders = filteredOrders.filter(o => o.status === 'refunded').length

    // Delivery fees
    const deliveryFees = activeFilteredOrders
      .filter(o => o.orderType === 'delivery' && o.deliveryFee)
      .map(o => o.deliveryFee || 0)
    const averageDeliveryFee = deliveryFees.length > 0
      ? deliveryFees.reduce((sum, fee) => sum + fee, 0) / deliveryFees.length
      : 0

    setStats({
      totalOrders,
      totalRevenue,
      averageOrderValue,
      totalCustomers: uniqueCustomers,
      receiveInPersonOrders,
      dineInOrders,
      deliveryOrders,
      completedOrders,
      cancelledOrders,
      refundedOrders,
      averageDeliveryFee,
    })

    // Calculate popular products
    const productMap = new Map<string, { quantity: number; revenue: number; orders: Set<string> }>()

    activeFilteredOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = productMap.get(item.productName) || { quantity: 0, revenue: 0, orders: new Set() }
        existing.quantity += item.quantity
        existing.revenue += item.total
        existing.orders.add(order._id)
        productMap.set(item.productName, existing)
      })
    })

    const popular = Array.from(productMap.entries())
      .map(([name, data]) => ({
        productName: name,
        totalQuantity: data.quantity,
        totalRevenue: data.revenue,
        orderCount: data.orders.size,
      }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 10)

    setPopularProducts(popular)

    // Calculate revenue by area
    const areaMap = new Map<string, { count: number; revenue: number }>()

    activeFilteredOrders.filter(o => o.orderType === 'delivery' && o.deliveryArea).forEach(order => {
      const areaName = order.deliveryArea!.name_en
      const existing = areaMap.get(areaName) || { count: 0, revenue: 0 }
      existing.count += 1
      existing.revenue += order.totalAmount
      areaMap.set(areaName, existing)
    })

    const areaStats = Array.from(areaMap.entries())
      .map(([name, data]) => ({
        areaName: name,
        orderCount: data.count,
        totalRevenue: data.revenue,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)

    setRevenueByArea(areaStats)

    // Top drivers (completed delivery orders with assignedDriver) — for tenant variant
    const deliveryCompleted = activeFilteredOrders.filter(
      o => o.orderType === 'delivery' && o.status === 'completed' && o.assignedDriver
    )
    const driverMap = new Map<string, number>()
    deliveryCompleted.forEach(o => {
      const id = o.assignedDriver!._id
      const name = o.assignedDriver!.name || 'Driver'
      driverMap.set(id, (driverMap.get(id) ?? 0) + 1)
    })
    const driverNames = new Map<string, string>()
    deliveryCompleted.forEach(o => {
      if (o.assignedDriver) driverNames.set(o.assignedDriver._id, o.assignedDriver.name || 'Driver')
    })
    const topDriversList = Array.from(driverMap.entries())
      .map(([id, count]) => ({ driverName: driverNames.get(id) || 'Driver', completedDeliveries: count }))
      .sort((a, b) => b.completedDeliveries - a.completedDeliveries)
      .slice(0, 10)
    setTopDrivers(topDriversList)

    // Orders by hour (0–23) — for tenant variant
    const hourCounts = new Map<number, number>()
    for (let h = 0; h < 24; h++) hourCounts.set(h, 0)
    activeFilteredOrders.forEach(o => {
      const h = new Date(o.createdAt).getHours()
      hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1)
    })
    setOrdersByHour(Array.from(hourCounts.entries()).map(([hour, count]) => ({ hour, count })))

    // Orders by day of week (0 Sun – 6 Sat) — for tenant variant
    const dayLabels = [t('Sun', 'أحد'), t('Mon', 'إثنين'), t('Tue', 'ثلاثاء'), t('Wed', 'أربعاء'), t('Thu', 'خميس'), t('Fri', 'جمعة'), t('Sat', 'سبت')]
    const dayCounts = new Map<number, number>()
    for (let d = 0; d < 7; d++) dayCounts.set(d, 0)
    activeFilteredOrders.forEach(o => {
      const d = new Date(o.createdAt).getDay()
      dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1)
    })
    setOrdersByDay(
      Array.from(dayCounts.entries()).map(([day, count]) => ({ day, label: dayLabels[day], count }))
    )
  }, [dateRange, startDate, endDate, t])

  useEffect(() => {
    calculateStats(orders)
  }, [orders, calculateStats])

  const currency = orders[0]?.currency || 'ILS'

  const content = (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl shadow-lg p-6 mb-6 text-white border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-black mb-1 flex items-center gap-2">
                <TrendingUp className="w-8 h-8" />
                {title}
              </h1>
              <p className="text-slate-300">
                {subtitle}
              </p>
            </div>
          </div>

            {/* Date Range Filter */}
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => {
                    setDateRange('today')
                    setStartDate('')
                    setEndDate('')
                  }}
                  variant={dateRange === 'today' && !startDate ? 'default' : 'outline'}
                  size="sm"
                  className={`rounded-lg ${dateRange === 'today' && !startDate ? 'bg-white text-black' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  Today
                </Button>
                <Button
                  onClick={() => {
                    setDateRange('week')
                    setStartDate('')
                    setEndDate('')
                  }}
                  variant={dateRange === 'week' && !startDate ? 'default' : 'outline'}
                  size="sm"
                  className={`rounded-lg ${dateRange === 'week' && !startDate ? 'bg-white text-black' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
                >
                  Last 7 Days
                </Button>
                <Button
                  onClick={() => {
                    setDateRange('month')
                    setStartDate('')
                    setEndDate('')
                  }}
                  variant={dateRange === 'month' && !startDate ? 'default' : 'outline'}
                  size="sm"
                  className={`rounded-lg ${dateRange === 'month' && !startDate ? 'bg-white text-black' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
                >
                  Last 30 Days
                </Button>
                <Button
                  onClick={() => {
                    setDateRange('all')
                    setStartDate('')
                    setEndDate('')
                  }}
                  variant={dateRange === 'all' && !startDate ? 'default' : 'outline'}
                  size="sm"
                  className={`rounded-lg ${dateRange === 'all' && !startDate ? 'bg-white text-black' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
                >
                  All Time
                </Button>
              </div>

              {/* Custom Time Range */}
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-sm text-slate-300">Custom Range:</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setDateRange('all')
                  }}
                  className="w-fit rounded-lg bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-white"
                  placeholder="Start date"
                />
                <span className="text-slate-300">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setDateRange('all')
                  }}
                  className="w-fit rounded-lg bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-white"
                  placeholder="End date"
                />
                {(startDate || endDate) && (
                  <Button
                    onClick={() => {
                      setStartDate('')
                      setEndDate('')
                      setDateRange('all')
                    }}
                    variant="outline"
                    size="sm"
                    className="rounded-lg bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Total Revenue */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-green-400" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Total Revenue
                </h3>
                <p className="text-3xl font-black text-white">
                  {stats.totalRevenue.toFixed(2)} {formatCurrency(currency)}
                </p>
              </div>

              {/* Total Orders */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <Package className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Total Orders
                </h3>
                <p className="text-3xl font-black text-white">{stats.totalOrders}</p>
                <p className="text-sm text-slate-400 mt-1">
                  {stats.completedOrders} completed
                  {stats.cancelledOrders > 0 ? ` • ${stats.cancelledOrders} cancelled` : ''}
                  {stats.refundedOrders > 0 ? ` • ${stats.refundedOrders} refunded` : ''}
                </p>
              </div>

              {/* Average Order Value */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Avg Order Value
                </h3>
                <p className="text-3xl font-black text-white">
                  {stats.averageOrderValue.toFixed(2)} {formatCurrency(currency)}
                </p>
              </div>

              {/* Total Customers */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-orange-400" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Unique Customers
                </h3>
                <p className="text-3xl font-black text-white">{stats.totalCustomers}</p>
              </div>
            </div>
          )}

          {/* Order Types & Delivery Stats */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Receive in Person / Dine-in / Delivery */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-lg p-6 text-white">
                <h3 className="text-lg font-black mb-4 text-white">{t('Order Types', 'أنواع الطلبات')}</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Store className="w-5 h-5 text-slate-300" />
                      <span className="font-semibold text-white">{t('Receive in Person', 'استلام شخصي')}</span>
                    </div>
                    <span className="font-black text-xl text-white">{stats.receiveInPersonOrders}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-slate-400 h-2 rounded-full"
                      style={{
                        width: `${stats.totalOrders > 0 ? (stats.receiveInPersonOrders / stats.totalOrders) * 100 : 0}%`
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                      <UtensilsCrossed className="w-5 h-5 text-blue-400" />
                      <span className="font-semibold text-white">{t('Dine-in', 'تناول هنا')}</span>
                    </div>
                    <span className="font-black text-xl text-white">{stats.dineInOrders}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${stats.totalOrders > 0 ? (stats.dineInOrders / stats.totalOrders) * 100 : 0}%`
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                      <Truck className="w-5 h-5 text-green-400" />
                      <span className="font-semibold text-white">{t('Delivery', 'توصيل')}</span>
                    </div>
                    <span className="font-black text-xl text-white">{stats.deliveryOrders}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${stats.totalOrders > 0 ? (stats.deliveryOrders / stats.totalOrders) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Stats — for business: delivery fees go to drivers, so we show counts only */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-lg p-6 text-white">
                <h3 className="text-lg font-black mb-4 text-white">
                  {variant === 'tenant' ? t('Delivery Overview', 'نظرة على التوصيل') : 'Delivery Stats'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">{t('Delivery orders', 'طلبات التوصيل')}</p>
                    <p className="text-2xl font-black text-white">{stats.deliveryOrders}</p>
                    {variant === 'tenant' && (
                      <p className="text-xs text-slate-500 mt-1">{t('Fees go to drivers', 'الرسوم تذهب للسائقين')}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Avg Delivery Fee</p>
                    <p className="text-2xl font-black text-white">
                      {stats.averageDeliveryFee.toFixed(2)} {formatCurrency(currency)}
                    </p>
                  </div>
                  {variant !== 'tenant' && (
                    <div>
                      <p className="text-sm text-slate-400 mb-1">Total Delivery Revenue</p>
                      <p className="text-2xl font-black text-white">
                        {orders
                          .filter(o => o.orderType === 'delivery' && o.status !== 'cancelled' && o.status !== 'refunded')
                          .reduce((sum, o) => sum + o.totalAmount, 0)
                          .toFixed(2)} {formatCurrency(currency)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Success Rate */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-lg p-6 text-white">
                <h3 className="text-lg font-black mb-4 text-white">Order Completion</h3>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-green-500/20 border border-green-500/30 mb-3">
                    <div className="text-center">
                      <p className="text-4xl font-black text-green-400">
                        {stats.totalOrders > 0
                          ? Math.round((stats.completedOrders / Math.max(1, stats.totalOrders - stats.cancelledOrders - stats.refundedOrders)) * 100)
                          : 0}%
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400">
                    {stats.completedOrders} of {stats.totalOrders - stats.cancelledOrders - stats.refundedOrders} active orders completed
                    {(stats.cancelledOrders > 0 || stats.refundedOrders > 0) && (
                      <span className="block text-red-400 mt-1">
                        {stats.cancelledOrders > 0 && `${stats.cancelledOrders} cancelled`}
                        {stats.cancelledOrders > 0 && stats.refundedOrders > 0 && ' • '}
                        {stats.refundedOrders > 0 && `${stats.refundedOrders} refunded`}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tenant: Top drivers we worked with */}
          {variant === 'tenant' && topDrivers.length > 0 && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-lg p-6 mb-6 text-white">
              <h3 className="text-xl font-black mb-4 flex items-center gap-2 text-white">
                <Award className="w-6 h-6 text-amber-400" />
                {t('Top drivers we worked with', 'أبرز السائقين الذين تعاملنا معهم')}
              </h3>
              <div className="space-y-3">
                {topDrivers.map((driver, index) => (
                  <div
                    key={driver.driverName + index}
                    className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl border border-slate-600/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                        index === 0 ? 'bg-amber-500 text-white' :
                        index === 1 ? 'bg-slate-400 text-white' :
                        index === 2 ? 'bg-orange-600 text-white' : 'bg-slate-600 text-slate-200'
                      }`}>
                        {index + 1}
                      </div>
                      <p className="font-bold text-lg text-white">{driver.driverName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-2xl text-white">{driver.completedDeliveries}</p>
                      <p className="text-sm text-slate-400">{t('deliveries', 'توصيلة')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tenant: Peak hours & Orders by day */}
          {variant === 'tenant' && (ordersByHour.some(x => x.count > 0) || ordersByDay.some(x => x.count > 0)) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {ordersByHour.some(x => x.count > 0) && (
                <div className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-lg p-6 text-white">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-white">
                    <BarChart3 className="w-5 h-5 text-cyan-400" />
                    {t('Orders by hour', 'الطلبات حسب الساعة')}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {ordersByHour.map(({ hour, count }) => (
                      <div key={hour} className="flex flex-col items-center gap-1">
                        <span className="text-xs text-slate-400">{hour}:00</span>
                        <div
                          className="w-8 rounded-t bg-cyan-500/80 min-h-[4px]"
                          style={{ height: `${Math.max(4, Math.min(80, count * 12))}px` }}
                          title={`${count} orders`}
                        />
                        <span className="text-xs font-medium text-white">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {ordersByDay.some(x => x.count > 0) && (
                <div className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-lg p-6 text-white">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-white">
                    <Calendar className="w-5 h-5 text-emerald-400" />
                    {t('Orders by day of week', 'الطلبات حسب اليوم')}
                  </h3>
                  <div className="space-y-2">
                    {ordersByDay.map(({ day, label, count }) => (
                      <div key={day} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-200">{label}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${stats && stats.totalOrders > 0 ? (count / stats.totalOrders) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-sm font-black text-white w-6 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Popular Products */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-lg p-6 mb-6 text-white">
            <h3 className="text-xl font-black mb-4 flex items-center gap-2 text-white">
              <Star className="w-6 h-6 text-yellow-400" />
              Top 10 Most Ordered Products
            </h3>
            {popularProducts.length === 0 ? (
              <p className="text-center text-slate-400 py-8">No products data available</p>
            ) : (
              <div className="space-y-3">
                {popularProducts.map((product, index) => (
                  <div
                    key={product.productName}
                    className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl hover:bg-slate-700 transition-colors border border-slate-600/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${index === 0 ? 'bg-yellow-500 text-white' :
                        index === 1 ? 'bg-slate-400 text-white' :
                          index === 2 ? 'bg-orange-500 text-white' :
                            'bg-slate-600 text-slate-200'
                        }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-bold text-lg text-white">{product.productName}</p>
                        <p className="text-sm text-slate-400">
                          Ordered {product.orderCount} times
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-2xl text-white">{product.totalQuantity}</p>
                      <p className="text-sm text-slate-400">
                        {product.totalRevenue.toFixed(2)} {formatCurrency(currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Revenue by Area */}
          {revenueByArea.length > 0 && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-lg p-6 text-white">
              <h3 className="text-xl font-black mb-4 flex items-center gap-2 text-white">
                <Truck className="w-6 h-6 text-green-400" />
                Revenue by Delivery Area
              </h3>
              <div className="space-y-3">
                {revenueByArea.map((area) => (
                  <div
                    key={area.areaName}
                    className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl border border-slate-600/50"
                  >
                    <div>
                      <p className="font-bold text-lg text-white">{area.areaName}</p>
                      <p className="text-sm text-slate-400">
                        {area.orderCount} {area.orderCount === 1 ? 'order' : 'orders'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-2xl text-white">
                        {area.totalRevenue.toFixed(2)} {formatCurrency(currency)}
                      </p>
                      <p className="text-sm text-slate-400">
                        Avg: {(area.totalRevenue / area.orderCount).toFixed(2)} {formatCurrency(currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  )

  if (wrapWithAdmin) {
    return <AdminProtection pageName={title}>{content}</AdminProtection>
  }
  return content
}
