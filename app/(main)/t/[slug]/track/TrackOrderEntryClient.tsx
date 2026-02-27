'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/components/LanguageContext'
import { toEnglishDigits } from '@/lib/phone'
import { Package, ArrowLeft, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type OrderRow = { orderNumber?: string; createdAt?: string; trackingToken?: string }

export function TrackOrderEntryClient({ slug }: { slug: string }) {
  const { t, lang } = useLanguage()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalized = toEnglishDigits(phone).replace(/\D/g, '')
    if (!normalized.trim()) {
      setError(t('Please enter your phone number.', 'يرجى إدخال رقم هاتفك.'))
      return
    }
    setLoading(true)
    setError(null)
    setOrders([])
    try {
      const res = await fetch(
        `/api/tenants/${slug}/orders/by-phone?phone=${encodeURIComponent(phone)}`,
        { cache: 'no-store' }
      )
      const data = await res.json().catch(() => ({}))
      const list = Array.isArray(data?.orders) ? data.orders : []
      setOrders(list)
      if (list.length === 0) {
        setError(t('No orders found for this number.', 'لم يتم العثور على طلبات لهذا الرقم.'))
      }
    } catch {
      setError(t('Something went wrong.', 'حدث خطأ ما.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Link
        href={`/t/${slug}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 mb-8"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t('Back to menu', 'العودة إلى القائمة')}
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
            <Package className="h-6 w-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              {t('Track your order', 'تتبع طلبك')}
            </h1>
            <p className="text-sm text-slate-500">
              {t('Enter the phone number you used when placing the order.', 'أدخل رقم الهاتف الذي استخدمته عند الطلب.')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {t('Phone number', 'رقم الهاتف')}
            </label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(toEnglishDigits(e.target.value))}
              placeholder={lang === 'ar' ? '05xxxxxxxx' : 'e.g. 0501234567'}
              className="w-full rounded-xl border-slate-300"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">{error}</p>
          )}
          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading ? t('Searching…', 'جاري البحث…') : t('Find my orders', 'البحث عن طلباتي')}
          </Button>
        </form>

        {orders.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-sm font-medium text-slate-700 mb-3">
              {orders.length === 1
                ? t('Your order', 'طلبك')
                : t('Your orders', 'طلباتك')}
            </p>
            <ul className="space-y-2">
              {orders.map((o) => (
                <li key={o.trackingToken}>
                  <Link
                    href={`/t/${slug}/track/${o.trackingToken}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left rtl:text-right hover:bg-slate-100 transition-colors"
                  >
                    <span className="font-medium text-slate-800">
                      #{o.orderNumber ?? '—'}
                    </span>
                    <span className="text-sm text-slate-500">
                      {o.createdAt
                        ? new Date(o.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
