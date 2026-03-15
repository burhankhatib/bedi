'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Package, Search, Flag, Undo2 } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { getCityDisplayName } from '@/lib/registration-translations'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ReportFormModal } from '@/components/Reports/ReportFormModal'

type HistoryOrder = {
  orderId: string
  orderNumber: string
  customerName: string
  customerPhone: string
  businessName: string
  businessAddress: string
  businessMapsLink?: string
  city: string
  deliveryAddress: string
  deliveryLat?: number
  deliveryLng?: number
  deliveryFee: number
  shopperFee?: number
  totalAmount: number
  tipAmount: number
  tipPercent: number
  amountToPayTenant: number
  currency: string
  status: string
  completedAt?: string
  driverCancelledAt?: string
  createdAt?: string
  canUndoDecline?: boolean
}

export function DriverHistoryClient() {
  const { t, lang } = useLanguage()
  const [orders, setOrders] = useState<HistoryOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [reportOrderId, setReportOrderId] = useState<string | null>(null)
  const [undoLoading, setUndoLoading] = useState<string | null>(null)
  const latestRequestRef = useRef(0)

  const fetchHistory = useCallback(() => {
    const requestId = ++latestRequestRef.current
    const ac = new AbortController()
    setLoading(true)
    const url = `/api/driver/orders/history${debouncedSearch ? `?q=${encodeURIComponent(debouncedSearch)}` : ''}`
    return fetch(url, { cache: 'no-store', signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (latestRequestRef.current === requestId) {
          setOrders(Array.isArray(data?.orders) ? data.orders : [])
        }
      })
      .catch((err) => {
        if ((err as Error)?.name !== 'AbortError' && latestRequestRef.current === requestId) setOrders([])
      })
      .finally(() => {
        if (latestRequestRef.current === requestId) setLoading(false)
      })
  }, [debouncedSearch])

  const handleUndoDecline = useCallback(
    async (orderId: string) => {
      setUndoLoading(orderId)
      try {
        const res = await fetch(`/api/driver/orders/${orderId}/undo-decline`, { method: 'POST' })
        const data = await res.json()
        if (res.ok && data.success) {
          fetchHistory()
        }
      } finally {
        setUndoLoading(null)
      }
    },
    [fetchHistory]
  )

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-white mb-1">
          {t('Delivery History', 'سجل التوصيلات')}
        </h1>
        <p className="text-slate-400 text-sm">
          {t('Search by order number, customer name, or phone', 'ابحث برقم الطلب أو اسم العميل أو رقم الهاتف')}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          type="text"
          placeholder={t('Search deliveries…', 'ابحث في التوصيلات…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 pr-4 py-3 rounded-xl border-slate-700 bg-slate-800/60 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {loading ? (
        <p className="text-slate-400">{t('Loading…', 'جاري التحميل…')}</p>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-12 text-center">
          <Package className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-400 mb-2">
            {t('No deliveries found', 'لا توجد توصيلات')}
          </h3>
          <p className="text-slate-500">
            {debouncedSearch
              ? t('Try a different search term', 'جرّب كلمة بحث أخرى')
              : t('Completed deliveries will appear here', 'ستظهر التوصيلات المكتملة هنا')}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => (
            <li
              key={o.orderId}
              className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-lg font-bold text-white">#{o.orderNumber}</span>
                  <p className="text-slate-300 font-medium mt-0.5">{o.customerName}</p>
                  <p className="text-slate-400 text-sm">
                    {o.businessName}
                    {o.city ? ` · ${getCityDisplayName(o.city, lang)}` : ''}
                  </p>
                </div>
                <span
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    o.status === 'completed'
                      ? 'bg-green-500/20 text-green-400'
                      : o.status === 'cancelled' || o.status === 'driver_cancelled'
                        ? 'bg-amber-500/20 text-amber-400'
                        : o.status === 'driver_declined'
                          ? 'bg-slate-500/30 text-slate-400'
                          : 'bg-slate-600/50 text-slate-400'
                  }`}
                >
                  {o.status === 'completed'
                    ? t('Completed', 'مكتمل')
                    : o.status === 'cancelled' || o.status === 'driver_cancelled'
                      ? t('Cancelled', 'ملغي')
                      : o.status === 'driver_declined'
                        ? t('Declined', 'مرفوض')
                        : o.status}
                </span>
              </div>
              {(o.status === 'driver_cancelled' && o.driverCancelledAt) && (
                <p className="text-amber-400/90 text-sm mt-1">
                  {t('Cancelled at', 'تم الإلغاء في')}: {new Date(o.driverCancelledAt).toLocaleString()}
                </p>
              )}
              <p className="text-slate-400 text-sm mt-2">
                {t('Total', 'المجموع')} {o.totalAmount.toFixed(2)} {o.currency}
                {o.deliveryFee > 0 && (
                  <span className="text-slate-500"> · {t('Delivery fee', 'سعر التوصيل')}: {o.deliveryFee.toFixed(2)}</span>
                )}
                {(o.shopperFee ?? 0) > 0 && (
                  <span className="text-fuchsia-400/90"> · 🛍️ {t('Save Time', 'توفير الوقت')}: {(o.shopperFee ?? 0).toFixed(2)}</span>
                )}
                {o.tipAmount > 0 && (
                  <span className="text-rose-400"> · 💚 {t('Tip', 'إكرامية')}: {o.tipAmount.toFixed(2)}</span>
                )}
              </p>
              <div className="mt-3 pt-3 border-t border-slate-700/60 flex flex-wrap gap-2">
                {o.canUndoDecline && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/10"
                    onClick={() => handleUndoDecline(o.orderId)}
                    disabled={undoLoading === o.orderId}
                  >
                    <Undo2 className="w-4 h-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                    {undoLoading === o.orderId ? t('Wait...', 'انتظر...') : t('Undo decline', 'إلغاء الرفض')}
                  </Button>
                )}
                {o.status === 'completed' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-slate-300"
                    onClick={() => setReportOrderId(o.orderId)}
                  >
                    <Flag className="w-4 h-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                    {t('Report customer', 'الإبلاغ عن العميل')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {reportOrderId && (
        <ReportFormModal
          open={true}
          onClose={() => setReportOrderId(null)}
          reporterType="driver"
          reportedType="customer"
          orderId={reportOrderId}
          onSuccess={() => setReportOrderId(null)}
        />
      )}
    </div>
  )
}
