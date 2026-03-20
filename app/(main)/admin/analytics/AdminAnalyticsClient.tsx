'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Building2,
  Truck,
  Users,
  FileWarning,
  ShoppingBag,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Settings,
  ExternalLink,
  Calendar,
  DollarSign,
  Download,
} from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  preparing: 'Preparing',
  waiting_for_delivery: 'Waiting for delivery',
  driver_on_the_way: 'Driver on the way',
  'out-for-delivery': 'Out for delivery',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

type DatePreset = 'all' | 'today' | 'yesterday' | 'last3' | 'last7' | 'lastMonth' | 'lastYear' | 'custom'

function getDateRangeForPreset(preset: DatePreset, customFrom?: string, customTo?: string): { from: string; to: string } | null {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1)

  if (preset === 'all') return null
  if (preset === 'custom' && customFrom && customTo) {
    const from = new Date(customFrom)
    const to = new Date(customTo)
    if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999)
      return { from: from.toISOString(), to: to.toISOString() }
    }
    return null
  }

  let start: Date
  let end: Date = new Date(todayEnd)

  switch (preset) {
    case 'today':
      start = new Date(todayStart)
      break
    case 'yesterday':
      start = new Date(todayStart)
      start.setDate(start.getDate() - 1)
      end = new Date(todayStart.getTime() - 1)
      break
    case 'last3':
      start = new Date(todayStart)
      start.setDate(start.getDate() - 2)
      break
    case 'last7':
      start = new Date(todayStart)
      start.setDate(start.getDate() - 6)
      break
    case 'lastMonth':
      start = new Date(todayStart)
      start.setMonth(start.getMonth() - 1)
      break
    case 'lastYear':
      start = new Date(todayStart)
      start.setFullYear(start.getFullYear() - 1)
      break
    default:
      return null
  }

  return { from: start.toISOString(), to: end.toISOString() }
}

function formatPresetLabel(preset: DatePreset): string {
  const labels: Record<DatePreset, string> = {
    all: 'All time',
    today: 'Today',
    yesterday: 'Yesterday',
    last3: 'Last 3 days',
    last7: 'Last 7 days',
    lastMonth: 'Last month',
    lastYear: 'Last year',
    custom: 'Custom',
  }
  return labels[preset]
}

type BusinessStat = {
  tenantId: string
  name: string
  slug: string
  ordersCount: number
  completedCount: number
  revenue?: number
  lastOrderAt: string | null
  deliveryCompleted?: number
  sponsoredDelivery?: number
  customerPaidDelivery?: number
  /** Completed deliveries where completedAt is in range (operations); null when no date filter. */
  deliveryCompletedOps?: number | null
  sponsoredDeliveryOps?: number | null
  customerPaidDeliveryOps?: number | null
}

type DeliveryAnalytics = {
  completedDeliveryOrders: number
  sponsoredDeliveryCompleted: number
  customerPaidDeliveryCompleted: number
}

type Stats = {
  tenantsCount: number
  driversCount: number
  ordersCount: number
  reportsCount: number
  ordersByStatus?: Record<string, number>
  businessStats?: BusinessStat[]
  ordersWithNoTenant?: number
  totalRevenue?: number
  deliveryAnalytics?: DeliveryAnalytics
  /** Deliveries completed in range (by completedAt); null when viewing all time. */
  deliveryAnalyticsByCompletion?: DeliveryAnalytics | null
  dateFrom?: string | null
  dateTo?: string | null
}

const CURRENCY_SYMBOL = '₪'

export function AdminAnalyticsClient() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [datePreset, setDatePreset] = useState<DatePreset>('last7')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const dateRange = getDateRangeForPreset(datePreset, customFrom, customTo)

  const fetchStats = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (dateRange) {
      if (dateRange.from) params.set('from', dateRange.from)
      if (dateRange.to) params.set('to', dateRange.to)
    }
    const url = `/api/admin/stats${params.toString() ? `?${params}` : ''}`
    fetch(url, { credentials: 'include' })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange?.from, dateRange?.to])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (datePreset === 'custom' && (!customFrom || !customTo)) {
        setLoading(false)
        setStats((prev) => prev ?? null)
        return
      }
      fetchStats()
    }, 0)
    return () => clearTimeout(timer)
  }, [datePreset, customFrom, customTo, fetchStats])

  if (loading && !stats) {
    return (
      <div className="mt-8 flex items-center justify-center gap-2 text-slate-400">
        <Loader2 className="size-5 animate-spin" />
        Loading…
      </div>
    )
  }

  const cards = [
    { label: 'Businesses', value: stats?.tenantsCount ?? 0, icon: Building2, href: '/admin/businesses', iconClass: 'bg-amber-500/20 text-amber-400' },
    { label: 'Drivers', value: stats?.driversCount ?? 0, icon: Truck, href: '/admin/drivers', iconClass: 'bg-blue-500/20 text-blue-400' },
    { label: 'Customers', value: '—', icon: Users, href: '/admin/customers', iconClass: 'bg-emerald-500/20 text-emerald-400' },
    { label: 'Orders', value: stats?.ordersCount ?? 0, icon: ShoppingBag, href: '/studio', iconClass: 'bg-violet-500/20 text-violet-400' },
    { label: 'Reports', value: stats?.reportsCount ?? 0, icon: FileWarning, href: '/admin/reports', iconClass: 'bg-rose-500/20 text-rose-400' },
  ]

  const ordersByStatus = stats?.ordersByStatus ?? {}
  const statusEntries = Object.entries(ordersByStatus).sort((a, b) => b[1] - a[1])
  const businessStats = stats?.businessStats ?? []
  const totalRevenue = stats?.totalRevenue ?? 0
  const deliveryAnalytics = stats?.deliveryAnalytics
  const deliveryAnalyticsByCompletion = stats?.deliveryAnalyticsByCompletion
  const showOpsDelivery = deliveryAnalyticsByCompletion != null

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { dateStyle: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { timeStyle: 'short' })
  }

  const formatRevenue = (n: number) => (Number.isFinite(n) ? `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${CURRENCY_SYMBOL}` : '—')

  return (
    <div className="mt-6 space-y-8">
      {/* Date filter */}
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Calendar className="size-5 text-slate-400" />
            Time period
          </h2>
          <a
            href={
              dateRange
                ? `/api/admin/stats?${new URLSearchParams({ from: dateRange.from, to: dateRange.to, download: '1' }).toString()}`
                : '/api/admin/stats?download=1'
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700/80"
          >
            <Download className="size-4 shrink-0" />
            Download JSON
          </a>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(['all', 'today', 'yesterday', 'last3', 'last7', 'lastMonth', 'lastYear', 'custom'] as DatePreset[]).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDatePreset(preset)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                datePreset === preset
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                  : 'bg-slate-800/50 text-slate-400 border border-slate-700/60 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              {formatPresetLabel(preset)}
            </button>
          ))}
          {datePreset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 ml-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white"
              />
            </div>
          )}
        </div>
        {dateRange && (
          <p className="mt-2 text-xs text-slate-500">
            Showing data from {new Date(dateRange.from).toLocaleDateString()} to {new Date(dateRange.to).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, href, iconClass }) => (
          <Link
            key={label}
            href={href}
            className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 transition-colors hover:bg-slate-800/50 hover:border-slate-700/60"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </div>
              <div className={`rounded-xl p-3 ${iconClass}`}>
                <Icon className="size-6" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Total revenue (when date filter applied) */}
      {(dateRange || totalRevenue > 0) && (
        <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-6">
          <div className="flex items-center gap-2">
            <DollarSign className="size-6 text-amber-400" />
            <h2 className="text-lg font-semibold text-amber-200">Total revenue (selected period)</h2>
          </div>
          <p className="mt-2 text-3xl font-black text-amber-400">{formatRevenue(totalRevenue)}</p>
          <p className="mt-1 text-sm text-slate-400">Sum of order totals for all businesses in the selected time range.</p>
        </div>
      )}

      {/* Orders by status */}
      {statusEntries.length > 0 && (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Orders by status</h2>
          <p className="mt-1 text-sm text-slate-400">Breakdown of orders in the selected period</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {statusEntries.map(([status, count]) => {
              const label = STATUS_LABELS[status] ?? status
              const isCompleted = status === 'completed'
              const isCancelled = status === 'cancelled' || status === 'refunded'
              const iconClass = isCompleted
                ? 'bg-emerald-500/20 text-emerald-400'
                : isCancelled
                  ? 'bg-slate-500/20 text-slate-400'
                  : 'bg-amber-500/20 text-amber-400'
              return (
                <div
                  key={status}
                  className={`flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-2.5 ${iconClass}`}
                >
                  {status === 'completed' && <CheckCircle2 className="size-4 shrink-0" />}
                  {(status === 'cancelled' || status === 'refunded') && <XCircle className="size-4 shrink-0" />}
                  {(status === 'new' || status === 'preparing' || status === 'waiting_for_delivery') && <Clock className="size-4 shrink-0" />}
                  {(status === 'driver_on_the_way' || status === 'out-for-delivery') && <Truck className="size-4 shrink-0" />}
                  <span className="font-medium">{label}</span>
                  <span className="font-bold tabular-nums">{count}</span>
                </div>
              )
            })}
          </div>
          {(stats?.ordersWithNoTenant ?? 0) > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              {stats?.ordersWithNoTenant} order(s) without a linked business (legacy data).
            </p>
          )}
        </div>
      )}

      {/* Completed delivery & free-to-customer (business-sponsored) — same date window as orders (by createdAt) */}
      {stats != null && deliveryAnalytics != null && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6">
          <div className="flex items-center gap-2">
            <Truck className="size-6 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Delivery completion &amp; sponsorship</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Completed delivery orders in this period (order <span className="font-mono text-slate-300">createdAt</span> in range). “Free to
            customer” means the business covered the delivery fee on the customer&apos;s receipt; the driver fee can still apply.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Completed deliveries</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-white">{deliveryAnalytics.completedDeliveryOrders}</p>
            </div>
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-200/80">Free to customer (sponsored)</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-amber-300">{deliveryAnalytics.sponsoredDeliveryCompleted}</p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Customer paid delivery</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-slate-200">{deliveryAnalytics.customerPaidDeliveryCompleted}</p>
            </div>
          </div>
          {deliveryAnalytics.completedDeliveryOrders === 0 && (
            <p className="mt-3 text-xs text-slate-500">No completed delivery orders in the selected window.</p>
          )}
        </div>
      )}

      {/* Operations: deliveries completed in period (by completedAt) — only when a date range is selected */}
      {stats != null && deliveryAnalyticsByCompletion != null && (
        <div className="rounded-2xl border border-cyan-500/25 bg-cyan-950/15 p-6">
          <div className="flex items-center gap-2">
            <Truck className="size-6 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">Operations view (by completion time)</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Completed delivery orders whose <span className="font-mono text-slate-300">completedAt</span> falls in the same range. Use this
            to reconcile driver payouts and fulfillment; the block above follows order <span className="font-mono text-slate-300">createdAt</span>.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Completed deliveries</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-white">{deliveryAnalyticsByCompletion.completedDeliveryOrders}</p>
            </div>
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-200/80">Free to customer (sponsored)</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-amber-300">{deliveryAnalyticsByCompletion.sponsoredDeliveryCompleted}</p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Customer paid delivery</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-slate-200">{deliveryAnalyticsByCompletion.customerPaidDeliveryCompleted}</p>
            </div>
          </div>
        </div>
      )}

      {/* Per-business metrics */}
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 overflow-hidden">
        <div className="border-b border-slate-800/60 px-4 py-3 md:px-6">
          <h2 className="text-lg font-semibold text-white">Business overview</h2>
          <p className="mt-1 text-sm text-slate-400">Orders, revenue and activity per business (sorted by order volume)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800/60 text-slate-400">
                <th className="px-4 py-3 font-medium md:px-6">Business</th>
                <th className="px-4 py-3 font-medium md:px-6">Slug</th>
                <th className="px-4 py-3 font-medium md:px-6 text-right">Orders</th>
                <th className="px-4 py-3 font-medium md:px-6 text-right">Completed</th>
                <th className="px-4 py-3 font-medium md:px-6 text-right" title="Completed delivery orders (created in period)">
                  Del. done
                </th>
                <th className="px-4 py-3 font-medium md:px-6 text-right text-amber-200/90" title="Business-sponsored: free delivery on customer receipt">
                  Sponsored
                </th>
                <th className="px-4 py-3 font-medium md:px-6 text-right" title="Customer paid delivery fee on receipt">
                  Cust. paid
                </th>
                {showOpsDelivery && (
                  <>
                    <th
                      className="px-4 py-3 font-medium md:px-6 text-right text-cyan-200/85"
                      title="Completed deliveries with completedAt in range (operations)"
                    >
                      Ops del.
                    </th>
                    <th
                      className="px-4 py-3 font-medium md:px-6 text-right text-amber-200/85"
                      title="Sponsored among ops deliveries"
                    >
                      Ops spons.
                    </th>
                    <th className="px-4 py-3 font-medium md:px-6 text-right text-cyan-200/85" title="Customer-paid fee among ops deliveries">
                      Ops cust.
                    </th>
                  </>
                )}
                <th className="px-4 py-3 font-medium md:px-6 text-right">Revenue</th>
                <th className="px-4 py-3 font-medium md:px-6">Last order</th>
                <th className="px-4 py-3 md:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {businessStats.length === 0 ? (
                <tr>
                  <td colSpan={showOpsDelivery ? 13 : 10} className="px-4 py-12 text-center text-slate-500 md:px-6">
                    No businesses or no order data yet.
                  </td>
                </tr>
              ) : (
                businessStats.map((b) => (
                  <tr
                    key={b.tenantId}
                    className="border-b border-slate-800/40 transition-colors hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-3 md:px-6">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 shrink-0 text-slate-500" />
                        <span className="font-medium">{b.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400 md:px-6">/t/{b.slug}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums md:px-6">{b.ordersCount}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 tabular-nums md:px-6">{b.completedCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-300 md:px-6">{b.deliveryCompleted ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-300 md:px-6">{b.sponsoredDelivery ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-300 md:px-6">{b.customerPaidDelivery ?? 0}</td>
                    {showOpsDelivery && (
                      <>
                        <td className="px-4 py-3 text-right tabular-nums text-cyan-200/90 md:px-6">{b.deliveryCompletedOps ?? 0}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-300 md:px-6">{b.sponsoredDeliveryOps ?? 0}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-cyan-200/90 md:px-6">{b.customerPaidDeliveryOps ?? 0}</td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right text-amber-400 tabular-nums md:px-6">{formatRevenue(b.revenue ?? 0)}</td>
                    <td className="px-4 py-3 text-slate-400 md:px-6">{formatDate(b.lastOrderAt)}</td>
                    <td className="px-4 py-3 md:px-6">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/t/${b.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-700/50 hover:text-white"
                          title="Open menu"
                        >
                          <ExternalLink className="size-4" />
                        </Link>
                        <Link
                          href={`/t/${b.slug}/manage`}
                          className="rounded-lg p-2 text-amber-400 hover:bg-slate-700/50 hover:text-amber-300"
                          title="Open control panel"
                        >
                          <Settings className="size-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
