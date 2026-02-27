'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/components/LanguageContext'
import { Package, ChevronRight, Clock, CheckCircle2, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type MyOrderRow = {
  _id: string
  orderNumber?: string
  orderType?: string
  status?: string
  totalAmount?: number
  currency?: string
  createdAt?: string
  completedAt?: string
  trackingToken?: string
  siteSlug?: string
  siteName?: string
}

const ACTIVE_STATUSES = new Set(['new', 'preparing', 'waiting_for_delivery', 'driver_on_the_way', 'out-for-delivery'])

const STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  new: { en: 'Received', ar: 'مستلم' },
  preparing: { en: 'Preparing', ar: 'قيد التحضير' },
  waiting_for_delivery: { en: 'Waiting for delivery', ar: 'في انتظار التوصيل' },
  driver_on_the_way: { en: 'Driver on the way', ar: 'السائق في الطريق' },
  'out-for-delivery': { en: 'On the way to you', ar: 'في الطريق إليك' },
  completed: { en: 'Completed', ar: 'مكتمل' },
  cancelled: { en: 'Cancelled', ar: 'ملغي' },
  refunded: { en: 'Refunded', ar: 'مسترد' },
}

/** DD-MM-YYYY with English numerals only (e.g. 22-02-2026). */
function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = String(d.getFullYear())
  return `${day}-${month}-${year}`
}

function formatAmount(amount: number | undefined, currency: string | undefined): string {
  if (typeof amount !== 'number') return '—'
  const c = (currency || '').trim() || '₪'
  return `${amount.toFixed(2)} ${c}`
}

export function MyOrdersClient({ initialOrders }: { initialOrders: MyOrderRow[] }) {
  const { t, lang } = useLanguage()
  const [orders, setOrders] = useState<MyOrderRow[]>(initialOrders)
  const [tab, setTab] = useState<'active' | 'history'>('active')

  useEffect(() => {
    setOrders(initialOrders)
  }, [initialOrders])

  const active = orders.filter((o) => o.status && ACTIVE_STATUSES.has(o.status))
  const history = orders.filter((o) => !o.status || !ACTIVE_STATUSES.has(o.status))

  const statusLabel = (status: string | undefined) => {
    if (!status) return '—'
    const s = STATUS_LABELS[status]
    return s ? (lang === 'ar' ? s.ar : s.en) : status
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">
          {t('My orders', 'طلباتي')}
        </h1>
        <p className="text-slate-500 text-sm mb-6">
          {t('Active orders and history from all businesses.', 'الطلبات النشطة والسابقة من جميع المتاجر.')}
        </p>

        <div className="flex rounded-xl bg-slate-200/80 p-1 mb-6">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${tab === 'active' ? 'bg-white text-slate-900 shadow' : 'text-slate-600'}`}
          >
            {t('Active', 'نشطة')} ({active.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${tab === 'history' ? 'bg-white text-slate-900 shadow' : 'text-slate-600'}`}
          >
            {t('History', 'السابقة')} ({history.length})
          </button>
        </div>

        {tab === 'active' && (
          <section className="space-y-3">
            {active.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                <Package className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                <p>{t('No active orders.', 'لا توجد طلبات نشطة.')}</p>
              </div>
            ) : (
              active.map((order) => (
                <OrderCard
                  key={order._id}
                  order={order}
                  isActive
                  lang={lang}
                  t={t}
                  statusLabel={statusLabel}
                  formatDate={formatDate}
                  formatAmount={formatAmount}
                />
              ))
            )}
          </section>
        )}

        {tab === 'history' && (
          <section className="space-y-3">
            {history.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                <Clock className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                <p>{t('No order history yet.', 'لا توجد طلبات سابقة بعد.')}</p>
              </div>
            ) : (
              history.map((order) => (
                <OrderCard
                  key={order._id}
                  order={order}
                  isActive={false}
                  lang={lang}
                  t={t}
                  statusLabel={statusLabel}
                  formatDate={formatDate}
                  formatAmount={formatAmount}
                />
              ))
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function OrderCard({
  order,
  isActive,
  lang,
  t,
  statusLabel,
  formatDate: fmtDate,
  formatAmount: fmtAmount,
}: {
  order: MyOrderRow
  isActive: boolean
  lang: string
  t: (en: string, ar: string) => string
  statusLabel: (s: string | undefined) => string
  formatDate: (iso: string | undefined) => string
  formatAmount: (a: number | undefined, c: string | undefined) => string
}) {
  const trackHref = order.siteSlug && order.trackingToken ? `/t/${order.siteSlug}/track/${order.trackingToken}` : null
  const businessName = order.siteName?.trim() || order.siteSlug || t('Order', 'طلب')

  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        isActive
          ? 'border-emerald-300 border-l-4 border-l-emerald-500 bg-emerald-50/70 animate-pulse'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-0.5">
            <Store className="h-4 w-4 shrink-0" />
            <span className="truncate">{businessName}</span>
          </div>
          <p className="font-semibold text-slate-900">
            #{order.orderNumber || order._id.slice(-6)}
          </p>
          <p className="text-sm text-slate-500 mt-0.5">
            {statusLabel(order.status)} · {fmtDate(order.createdAt)}
          </p>
          <p className="text-sm font-medium text-slate-700 mt-1">
            {fmtAmount(order.totalAmount, order.currency)}
          </p>
        </div>
        {trackHref && (
          <Link href={trackHref}>
            <Button variant="outline" size="sm" className="shrink-0 gap-1">
              {t('Track', 'تتبع')}
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
