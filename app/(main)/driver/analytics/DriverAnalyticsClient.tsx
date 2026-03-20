'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { DollarSign, Package, MapPin, Store, Calendar, TrendingUp, Truck, Download } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { csvCell, downloadCsv } from '@/lib/csv-export'
import { useLanguage } from '@/components/LanguageContext'

type DriverOrder = {
  _id: string
  orderNumber: string
  deliveryFee: number
  tipAmount: number
  deliveryFeePaidByBusiness?: boolean
  currency: string
  completedAt: string
  areaName: string
  businessName: string
}

const tEn = {
  title: 'Delivery Analytics',
  subtitle: 'Your earnings, deliveries, top areas and businesses',
  today: 'Today',
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  allTime: 'All time',
  profit: 'Profit',
  tips: 'Tips earned',
  deliveries: 'Deliveries',
  topAreas: 'Top delivery areas',
  topBusinesses: 'Top businesses',
  noData: 'No data for this period.',
  deliveriesCount: 'deliveries',
  deliverySingular: 'delivery',
  loading: 'Loading…',
  deliveryBreakdownTitle: 'Delivery breakdown',
  freeForCustomerBusiness: 'Free for customer (business-sponsored)',
  customerPaidDelivery: 'Customer paid delivery fee',
  sponsoredDriverNote:
    'You still receive the delivery fee on business-sponsored orders; the customer did not pay it on their order total.',
  exportCsv: 'Export CSV',
  exportCsvAria: 'Download completed deliveries for the selected period as a spreadsheet',
}
const tAr = {
  title: 'تحليلات التوصيل',
  subtitle: 'أرباحك وتوصيلاتك وأبرز المناطق والشركات',
  today: 'اليوم',
  last7: 'آخر 7 أيام',
  last30: 'آخر 30 يوم',
  allTime: 'كل الفترات',
  profit: 'الأرباح',
  tips: 'الإكراميات',
  deliveries: 'عدد التوصيلات',
  topAreas: 'أبرز مناطق التوصيل',
  topBusinesses: 'أبرز الشركات',
  noData: 'لا توجد بيانات لهذه الفترة.',
  deliveriesCount: 'توصيلات',
  deliverySingular: 'توصيلة',
  loading: 'جاري التحميل...',
  deliveryBreakdownTitle: 'تفاصيل التوصيل',
  freeForCustomerBusiness: 'مجاني للعميل (الشركة تتحمّل رسوم التوصيل)',
  customerPaidDelivery: 'دفع العميل رسوم التوصيل',
  sponsoredDriverNote:
    'لا تزال تستلم رسوم التوصيل في الطلبات المُموّلة من الشركة؛ العميل لم يدفعها ضمن إجمالي طلبه.',
  exportCsv: 'تصدير CSV',
  exportCsvAria: 'تنزيل التوصيلات المكتملة للفترة المحددة كجدول بيانات',
}

function filterByRange(orders: DriverOrder[], range: 'today' | 'week' | 'month' | 'all'): DriverOrder[] {
  if (range === 'all') return orders
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return orders.filter((o) => {
    const t = new Date(o.completedAt).getTime()
    if (range === 'today') return t >= todayStart
    if (range === 'week') return t >= todayStart - 7 * 24 * 60 * 60 * 1000
    return t >= todayStart - 30 * 24 * 60 * 60 * 1000
  })
}

export function DriverAnalyticsClient() {
  const { lang } = useLanguage()
  const t = lang === 'ar' ? tAr : tEn
  const [orders, setOrders] = useState<DriverOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('today')

  useEffect(() => {
    let mounted = true
    const ac = new AbortController()
    fetch('/api/driver/analytics', { signal: ac.signal })
      .then((r) => r.json())
      .then((data) => {
        if (mounted && !ac.signal.aborted) setOrders(data?.orders ?? [])
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return
        if (mounted) setOrders([])
      })
      .finally(() => {
        if (mounted && !ac.signal.aborted) setLoading(false)
      })
    return () => {
      mounted = false
      ac.abort()
    }
  }, [])

  const filtered = useMemo(() => filterByRange(orders, dateRange), [orders, dateRange])
  const profit = useMemo(() => filtered.reduce((s, o) => s + o.deliveryFee, 0), [filtered])
  const totalTips = useMemo(() => filtered.reduce((s, o) => s + (o.tipAmount ?? 0), 0), [filtered])
  const currency = orders[0]?.currency ?? 'ILS'
  const freeDeliveryOrders = useMemo(
    () => filtered.filter((o) => o.deliveryFeePaidByBusiness === true).length,
    [filtered]
  )
  const customerPaidDeliveryFeeOrders = useMemo(
    () => filtered.filter((o) => o.deliveryFeePaidByBusiness !== true).length,
    [filtered]
  )

  const exportDeliveriesCsv = useCallback(() => {
    if (filtered.length === 0) return
    const header = [
      'orderNumber',
      'completedAt',
      'business',
      'area',
      'deliveryFee',
      'tip',
      'currency',
      'businessSponsoredDelivery',
    ]
    const lines = [header.join(',')]
    for (const o of filtered) {
      lines.push(
        [
          csvCell(o.orderNumber),
          csvCell(o.completedAt),
          csvCell(o.businessName),
          csvCell(o.areaName),
          csvCell(o.deliveryFee),
          csvCell(o.tipAmount ?? 0),
          csvCell(o.currency),
          csvCell(o.deliveryFeePaidByBusiness ? 'yes' : 'no'),
        ].join(',')
      )
    }
    downloadCsv(`zonify-driver-deliveries-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`, lines)
  }, [filtered, dateRange])

  const areas = useMemo(() => {
    const m = new Map<string, number>()
    filtered.forEach((o) => {
      const name = o.areaName && o.areaName !== '—' ? o.areaName : null
      if (name) m.set(name, (m.get(name) ?? 0) + 1)
    })
    return Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [filtered])

  const businesses = useMemo(() => {
    const m = new Map<string, number>()
    filtered.forEach((o) => {
      const name = o.businessName && o.businessName !== '—' ? o.businessName : '—'
      m.set(name, (m.get(name) ?? 0) + 1)
    })
    return Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [filtered])

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-slate-400">
        {t.loading}
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-white">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <TrendingUp className="h-7 w-7 text-green-400" />
          {t.title}
        </h1>
        <p className="mt-1 text-slate-400">{t.subtitle}</p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className={dateRange === 'today' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30' : 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-white'}
              onClick={() => setDateRange('today')}
            >
              <Calendar className="mr-1 h-4 w-4" />
              {t.today}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={dateRange === 'week' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30' : 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-white'}
              onClick={() => setDateRange('week')}
            >
              {t.last7}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={dateRange === 'month' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30' : 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-white'}
              onClick={() => setDateRange('month')}
            >
              {t.last30}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={dateRange === 'all' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30' : 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-white'}
              onClick={() => setDateRange('all')}
            >
              {t.allTime}
            </Button>
          </div>
          {filtered.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-white"
              onClick={exportDeliveriesCsv}
              aria-label={t.exportCsvAria}
            >
              <Download className="mr-1.5 h-4 w-4 shrink-0" />
              {t.exportCsv}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-800/80 p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/20">
              <DollarSign className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">{t.profit}</p>
              <p className="text-2xl font-black">
                {profit.toFixed(2)} {formatCurrency(currency)}
              </p>
            </div>
          </div>
        </div>
        {totalTips > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-800/80 p-5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/20">
                <DollarSign className="h-6 w-6 text-rose-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400">{t.tips}</p>
                <p className="text-2xl font-black text-rose-400">
                  {totalTips.toFixed(2)} {formatCurrency(currency)}
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="rounded-2xl border border-slate-800 bg-slate-800/80 p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20">
              <Package className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">{t.deliveries}</p>
              <p className="text-2xl font-black">{filtered.length}</p>
            </div>
          </div>
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-800/80 p-5 text-white">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
            <Truck className="h-5 w-5 text-green-400" />
            {t.deliveryBreakdownTitle}
          </h2>
          <div className="rounded-xl border border-slate-600/60 bg-slate-900/50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-amber-200/95">{t.freeForCustomerBusiness}</span>
              <span className="font-black tabular-nums text-white">{freeDeliveryOrders}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-300">{t.customerPaidDelivery}</span>
              <span className="font-black tabular-nums text-white">{customerPaidDeliveryFeeOrders}</span>
            </div>
            {freeDeliveryOrders > 0 && (
              <p className="text-xs text-slate-400 pt-1">
                {lang === 'ar'
                  ? `${Math.round((100 * freeDeliveryOrders) / filtered.length)}٪ من التوصيلات في هذه الفترة مموّلة من الشركة (مجانية للعميل).`
                  : `${Math.round((100 * freeDeliveryOrders) / filtered.length)}% of deliveries this period were business-sponsored (free to the customer).`}
              </p>
            )}
            <p className="text-xs text-slate-500 pt-2 border-t border-slate-700/80">{t.sponsoredDriverNote}</p>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-slate-800 bg-slate-800/50 p-6 text-center text-slate-400">{t.noData}</p>
      ) : (
        <>
          {areas.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-800/80 p-5 text-white">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
                <MapPin className="h-5 w-5 text-amber-400" />
                {t.topAreas}
              </h2>
              <ul className="space-y-2">
                {areas.map((a) => (
                  <li key={a.name} className="flex items-center justify-between rounded-xl bg-slate-700/50 px-4 py-3">
                    <span className="font-medium">{a.name}</span>
                    <span className="font-black text-green-400">
                      {a.count} {a.count === 1 ? t.deliverySingular : t.deliveriesCount}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {businesses.filter((b) => b.name !== '—').length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-800/80 p-5 text-white">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
                <Store className="h-5 w-5 text-cyan-400" />
                {t.topBusinesses}
              </h2>
              <ul className="space-y-2">
                {businesses
                  .filter((b) => b.name !== '—')
                  .map((b) => (
                    <li key={b.name} className="flex items-center justify-between rounded-xl bg-slate-700/50 px-4 py-3">
                      <span className="font-medium">{b.name}</span>
                      <span className="font-black text-cyan-400">
                        {b.count} {b.count === 1 ? t.deliverySingular : t.deliveriesCount}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
