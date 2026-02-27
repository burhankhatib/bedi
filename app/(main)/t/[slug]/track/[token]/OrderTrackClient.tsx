'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useLanguage } from '@/components/LanguageContext'
import { useSanityLiveStream } from '@/lib/useSanityLiveStream'
import { getWhatsAppUrl, normalizePhoneForWhatsApp } from '@/lib/whatsapp'
import { formatCurrency } from '@/lib/currency'
import Link from 'next/link'
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Truck,
  Store,
  Phone,
  MessageCircle,
  Copy,
  ExternalLink,
  Package,
  MapPin,
  UtensilsCrossed,
  ArrowLeft,
  Flag,
  HandHelping,
  CreditCard,
  Banknote,
  Coins,
  Users,
  Heart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/ToastProvider'
import { ReportFormModal } from '@/components/Reports/ReportFormModal'
import { CustomerTrackPushSetup } from './CustomerTrackPushSetup'

type OrderStatus =
  | 'new'
  | 'preparing'
  | 'waiting_for_delivery'
  | 'driver_on_the_way'
  | 'out-for-delivery'
  | 'completed'
  | 'served'
  | 'cancelled'
  | 'refunded'

type TrackData = {
  order: {
    _id: string
    orderNumber?: string
    orderType?: string
    status?: OrderStatus
    customerName?: string
    tableNumber?: string
    deliveryAddress?: string
    deliveryFee?: number
    items?: Array<{ productName?: string; quantity?: number; price?: number; total?: number; notes?: string; addOns?: string }>
    subtotal?: number
    totalAmount?: number
    currency?: string
    createdAt?: string
    completedAt?: string | null
    tipPercent?: number
    tipAmount?: number
    customerRequestedAt?: string | null
    customerRequestAcknowledgedAt?: string | null
  }
  restaurant: { name_en?: string; name_ar?: string; whatsapp?: string } | null
  driver: { _id: string; name: string; phoneNumber: string } | null
  country?: string
}

const STATUS_CONFIG: Record<string, { labelEn: string; labelAr: string; icon: typeof ChefHat; headerBg: string; headerFrom: string; headerTo: string }> = {
  new: { labelEn: 'Order received', labelAr: 'تم استلام الطلب', icon: Package, headerBg: 'from-blue-600 to-blue-700', headerFrom: 'from-blue-600', headerTo: 'to-blue-700' },
  preparing: { labelEn: 'Preparing', labelAr: 'قيد التحضير', icon: ChefHat, headerBg: 'from-amber-600 to-amber-700', headerFrom: 'from-amber-600', headerTo: 'to-amber-700' },
  waiting_for_delivery: { labelEn: 'Waiting for delivery', labelAr: 'في انتظار التوصيل', icon: Clock, headerBg: 'from-amber-600 to-amber-700', headerFrom: 'from-amber-600', headerTo: 'to-amber-700' },
  driver_on_the_way: { labelEn: 'Driver on the way to the store', labelAr: 'السائق في الطريق إلى المتجر', icon: Truck, headerBg: 'from-blue-600 to-blue-700', headerFrom: 'from-blue-600', headerTo: 'to-blue-700' },
  'out-for-delivery': { labelEn: 'Driver on the way to you', labelAr: 'السائق في الطريق إليك', icon: Truck, headerBg: 'from-purple-600 to-purple-700', headerFrom: 'from-purple-600', headerTo: 'to-purple-700' },
  completed: { labelEn: 'Completed', labelAr: 'مكتمل', icon: CheckCircle2, headerBg: 'from-emerald-600 to-emerald-700', headerFrom: 'from-emerald-600', headerTo: 'to-emerald-700' },
  served: { labelEn: 'Served', labelAr: 'تم التقديم', icon: UtensilsCrossed, headerBg: 'from-emerald-600 to-emerald-700', headerFrom: 'from-emerald-600', headerTo: 'to-emerald-700' },
  cancelled: { labelEn: 'Cancelled', labelAr: 'ملغى', icon: Clock, headerBg: 'from-red-600 to-red-700', headerFrom: 'from-red-600', headerTo: 'to-red-700' },
  refunded: { labelEn: 'Refunded', labelAr: 'مسترد', icon: CheckCircle2, headerBg: 'from-slate-600 to-slate-700', headerFrom: 'from-slate-600', headerTo: 'to-slate-700' },
}

const DEFAULT_COUNTRY_CODE = '972'

const DEFAULT_TIP_PERCENT = 10

export function OrderTrackClient({ slug, token }: { slug: string; token: string }) {
  const { t, lang } = useLanguage()
  const { showToast } = useToast()
  const [data, setData] = useState<TrackData | null>(null)
  const prevRequestAckRef = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [reportTarget, setReportTarget] = useState<'business' | 'driver' | null>(null)
  const [requestSending, setRequestSending] = useState(false)
  const [showCheckModal, setShowCheckModal] = useState(false)
  const [tipEnabled, setTipEnabled] = useState(false)
  const [tipPercent, setTipPercent] = useState(DEFAULT_TIP_PERCENT)
  const [splitPeople, setSplitPeople] = useState(1)

  const fetchTrack = useCallback(async (isRefetch = false) => {
    if (!slug || !token?.trim()) return
    if (!isRefetch) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch(`/api/tenants/${slug}/track/${encodeURIComponent(token)}`, { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 404) setError(t('Order not found or link expired.', 'الطلب غير موجود أو انتهت صلاحية الرابط.'))
        else setError(t('Something went wrong.', 'حدث خطأ ما.'))
        setData(null)
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      if (!isRefetch) setError(t('Failed to load order.', 'فشل تحميل الطلب.'))
      if (!isRefetch) setData(null)
    } finally {
      if (!isRefetch) setLoading(false)
    }
  }, [slug, token, t])

  useEffect(() => {
    fetchTrack(false)
  }, [fetchTrack])

  useEffect(() => {
    if (data?.order) {
      const hasTip = (data.order.tipAmount ?? 0) > 0 || (data.order.tipPercent ?? 0) > 0
      setTipEnabled(hasTip)
      if ((data.order.tipPercent ?? 0) > 0) setTipPercent(data.order.tipPercent ?? DEFAULT_TIP_PERCENT)
    }
  }, [data?.order?._id, data?.order?.tipPercent, data?.order?.tipAmount])

  // Toast when staff acknowledges table request (waiter on the way)
  useEffect(() => {
    const ack = data?.order?.customerRequestAcknowledgedAt ?? null
    if (ack && prevRequestAckRef.current !== ack) {
      prevRequestAckRef.current = ack
      showToast(
        t('Waiter is on the way.', 'النادل في الطريق إليك.'),
        t('Waiter is on the way.', 'النادل في الطريق إليك.'),
        'success'
      )
    }
    if (!ack) prevRequestAckRef.current = null
  }, [data?.order?.customerRequestAcknowledgedAt, showToast, t])

  const isDineIn = data?.order?.orderType === 'dine-in'
  const tableNumber = data?.order?.tableNumber ?? ''
  const subtotal = data?.order?.subtotal ?? 0
  const totalAmount = data?.order?.totalAmount ?? 0
  const currency = data?.order?.currency ?? 'ILS'
  const tipAmount = tipEnabled ? (subtotal * tipPercent) / 100 : 0
  const displayTotal = totalAmount + tipAmount
  const perPerson = splitPeople > 0 ? displayTotal / splitPeople : displayTotal

  const sendRequest = async (type: 'call_waiter' | 'request_check', paymentMethod?: 'cash' | 'card') => {
    if (!token || requestSending) return
    setRequestSending(true)
    try {
      const res = await fetch(`/api/tenants/${slug}/track/${encodeURIComponent(token)}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, paymentMethod }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Request failed')
      }
      setShowCheckModal(false)
      showToast(
        t('Request sent. Staff will be with you shortly.', 'تم إرسال الطلب. الطاقم في الطريق إليك.'),
        t('Request sent. Staff will be with you shortly.', 'تم إرسال الطلب. الطاقم في الطريق إليك.'),
        'success'
      )
      fetchTrack(true)
    } catch (e) {
      showToast(
        t('Could not send request. Please try again.', 'تعذر إرسال الطلب. حاول مرة أخرى.'),
        t('Could not send request. Please try again.', 'تعذر إرسال الطلب. حاول مرة أخرى.'),
        'error'
      )
    } finally {
      setRequestSending(false)
    }
  }

  const saveTip = async (percent: number, amount: number) => {
    if (!token) return
    try {
      await fetch(`/api/tenants/${slug}/track/${encodeURIComponent(token)}/tip`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipPercent: percent, tipAmount: amount }),
      })
      fetchTrack(true)
    } catch {
      // could toast
    }
  }

  const handleTipToggle = (enabled: boolean) => {
    setTipEnabled(enabled)
    if (enabled) {
      const amount = (subtotal * tipPercent) / 100
      saveTip(tipPercent, amount)
    } else {
      saveTip(0, 0)
    }
  }

  const handleTipPercentChange = (p: number) => {
    setTipPercent(p)
    if (tipEnabled) {
      const amount = (subtotal * p) / 100
      saveTip(p, amount)
    }
  }

  useSanityLiveStream(
    slug && token?.trim() ? `/api/tenants/${slug}/track/${encodeURIComponent(token)}/live` : null,
    () => fetchTrack(true)
  )

  const trackUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/t/${slug}/track/${token}`
      : ''

  const copyTrackLink = () => {
    if (!trackUrl) return
    navigator.clipboard.writeText(trackUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const countryCode = data?.country === 'IL' || data?.country === 'Israel' ? '972' : DEFAULT_COUNTRY_CODE

  if (loading && !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-500" />
          <p className="mt-4 text-slate-500">{t('Loading your order…', 'جاري تحميل طلبك…')}</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm max-w-md">
          <Package className="mx-auto h-14 w-14 text-slate-300" />
          <h1 className="mt-4 text-xl font-bold text-slate-800">{t('Order not found', 'الطلب غير موجود')}</h1>
          <p className="mt-2 text-slate-500">{error}</p>
          <Link href={`/t/${slug}`} className="mt-4 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700">
            {t('Back to menu', 'العودة إلى القائمة')}
          </Link>
        </div>
      </div>
    )
  }

  const isDelivery = data.order.orderType === 'delivery'
  const deliveryOnlyStatuses = ['waiting_for_delivery', 'driver_on_the_way', 'out-for-delivery']
  const rawStatusKey = (data.order.status || 'new') as keyof typeof STATUS_CONFIG
  const statusKey = (!isDelivery && deliveryOnlyStatuses.includes(data.order.status || '')) ? 'preparing' : rawStatusKey
  const statusCfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.new
  const StatusIcon = statusCfg.icon
  const businessName = (lang === 'ar' ? data.restaurant?.name_ar : data.restaurant?.name_en) || data.restaurant?.name_en || data.restaurant?.name_ar || ''
  const restaurantName = businessName || t('Store', 'المتجر')
  const statusLabel =
    statusKey === 'driver_on_the_way'
      ? businessName
        ? lang === 'ar'
          ? `السائق في الطريق إلى ${businessName}`
          : `Driver is on the way to ${businessName}`
        : t('Driver is on the way to the store', 'السائق في الطريق إلى المتجر')
      : lang === 'ar'
        ? statusCfg.labelAr
        : statusCfg.labelEn
  const deliveryFee = data.order.deliveryFee ?? 0

  return (
    <div className="mx-auto max-w-lg pb-24">
      <div className="px-4 pt-4 pb-2">
        <Link
          href={`/t/${slug}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('Back to menu', 'العودة إلى القائمة')}
        </Link>
      </div>

      {/* Enable notifications — at top, auto-prompt on visit */}
      <div className="px-4 pb-3">
        <CustomerTrackPushSetup slug={slug} token={token} />
      </div>

      {/* Status as main headline + dynamic header */}
      <div className={`rounded-b-3xl bg-gradient-to-b ${statusCfg.headerBg} px-6 pt-8 pb-10 text-white shadow-lg`}>
        <div className="flex items-center justify-center gap-3">
          <StatusIcon className="h-9 w-9 shrink-0 opacity-95" />
          <h1 className="text-2xl font-black text-center">
            {statusLabel}
          </h1>
        </div>
        <p className="mt-2 text-center text-white/90">
          {t('Order', 'الطلب')} #{data.order.orderNumber ?? data.order._id?.slice(-6)}
        </p>
      </div>

      {/* Order details */}
      <div className="mt-6 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-slate-500" />
              {t('Order details', 'تفاصيل الطلب')}
            </h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {(data.order.items ?? []).map((item, i) => (
              <li key={i} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{item.productName}</p>
                  {(item.notes || item.addOns) && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{[item.notes, item.addOns].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <span className="shrink-0 text-slate-600">
                  {item.quantity} × {item.price?.toFixed(2)} {formatCurrency(data.order.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 px-4 py-3 space-y-2">
            <div className="flex justify-between text-slate-700">
              <span>{t('Subtotal', 'المجموع الفرعي')}</span>
              <span>{(data.order.subtotal ?? 0).toFixed(2)} {formatCurrency(data.order.currency)}</span>
            </div>
            {isDelivery && deliveryFee > 0 && (
              <div className="flex justify-between text-slate-700">
                <span>{t('Delivery', 'التوصيل')}</span>
                <span>{deliveryFee.toFixed(2)} {formatCurrency(data.order.currency)}</span>
              </div>
            )}
            {tipEnabled && tipAmount > 0 && (
              <div className="flex justify-between text-slate-700">
                <span>{t('Tip', 'إكرامية')} ({tipPercent}%)</span>
                <span>{tipAmount.toFixed(2)} {formatCurrency(data.order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-slate-800 pt-1">
              <span>{t('Total', 'المجموع')}</span>
              <span>
                {displayTotal.toFixed(2)} {formatCurrency(data.order.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tips option — under total */}
      <div className="mt-4 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Heart className="h-5 w-5 text-rose-500" />
              {t('Add a tip?', 'إضافة إكرامية؟')}
            </h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tipEnabled}
                onChange={(e) => handleTipToggle(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">{t('Yes, add tip', 'نعم، أضف إكرامية')}</span>
            </label>
          </div>
          {tipEnabled && (
            <div className="px-4 py-3 flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-600">{t('Tip percentage', 'نسبة الإكرامية')}:</span>
              {[5, 10, 15, 20, 25].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleTipPercentChange(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tipPercent === p
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Split the bill — local only, friendly */}
      <div className="mt-4 px-4">
        <div className="rounded-2xl border border-slate-200 bg-amber-50/80 shadow-sm overflow-hidden border-amber-200/60">
          <div className="border-b border-amber-200/60 bg-amber-100/60 px-4 py-3">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-600" />
              {t('Split the bill', 'تقسيم الفاتورة')} 💛
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              {t('Dividing among friends? Choose how many people — we\'ll show each share.', 'تقسمون بين الأصدقاء؟ اختروا عدد الأشخاص وسنعرض حصة كل واحد.')}
            </p>
          </div>
          <div className="px-4 py-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">{t('Number of people', 'عدد الأشخاص')}:</span>
              <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSplitPeople((n) => Math.max(1, n - 1))}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 font-medium"
                >
                  −
                </button>
                <span className="min-w-[2.5rem] text-center font-semibold text-slate-800">{splitPeople}</span>
                <button
                  type="button"
                  onClick={() => setSplitPeople((n) => n + 1)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 font-medium"
                >
                  +
                </button>
              </div>
            </div>
            <div className="text-lg font-bold text-amber-800">
              {t('Each person pays', 'كل شخص يدفع')}: {perPerson.toFixed(2)} {formatCurrency(currency)} 🧾
            </div>
          </div>
        </div>
      </div>

      {/* Dine-in: Call waiter / Ask for check — hidden only when order is completed (paid/done) */}
      {isDineIn && data.order.status !== 'completed' && (
        <div className="mt-6 px-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-slate-500" />
                {t('Need something?', 'تحتاج شيئاً؟')}
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                {t('We\'ll let the staff know right away.', 'سنخبر الطاقم فوراً.')}
              </p>
              {data.order.customerRequestedAt && !data.order.customerRequestAcknowledgedAt && (
                <p className="mt-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-2">
                  <Clock className="h-4 w-4 animate-pulse" />
                  {t('Request sent — waiting for staff to respond.', 'تم إرسال الطلب — في انتظار رد الطاقم.')}
                </p>
              )}
            </div>
            <div className="p-4 flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={requestSending}
                onClick={() => sendRequest('call_waiter')}
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
              >
                <HandHelping className="mr-2 h-4 w-4" />
                {t('Call the waiter', 'استدعاء النادل')}
              </Button>
              <Button
                type="button"
                disabled={requestSending}
                onClick={() => setShowCheckModal(true)}
                variant="outline"
                className="rounded-xl border-slate-300"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {t('Ask for the check', 'طلب الفاتورة')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ask for check — Cash or Card */}
      {showCheckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCheckModal(false)}>
          <div className="rounded-2xl bg-white shadow-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 text-lg">{t('How would you like to pay?', 'كيف تفضل الدفع؟')}</h3>
            <div className="mt-4 flex gap-3">
              <Button
                type="button"
                onClick={() => sendRequest('request_check', 'cash')}
                disabled={requestSending}
                className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800"
              >
                <Banknote className="mr-2 h-4 w-4" />
                {t('Cash', 'نقداً')}
              </Button>
              <Button
                type="button"
                onClick={() => sendRequest('request_check', 'card')}
                disabled={requestSending}
                className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white"
              >
                <Coins className="mr-2 h-4 w-4" />
                {t('Card', 'بطاقة')}
              </Button>
            </div>
            <Button type="button" variant="ghost" className="mt-3 w-full" onClick={() => setShowCheckModal(false)}>
              {t('Cancel', 'إلغاء')}
            </Button>
          </div>
        </div>
      )}

      {/* Business contact */}
      {data.restaurant && (data.restaurant.whatsapp || data.restaurant.name_en || data.restaurant.name_ar) && (
        <div className="mt-6 px-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Store className="h-5 w-5 text-slate-500" />
                {restaurantName}
              </h2>
            </div>
            <div className="p-4 flex flex-wrap gap-3 items-center">
              {data.restaurant.whatsapp && (
                <>
                  <Button asChild size="sm" className="bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl">
                    <a href={getWhatsAppUrl(data.restaurant.whatsapp, '', countryCode) || '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      {t('WhatsApp', 'واتساب')}
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="rounded-xl border-slate-300">
                    <a href={`tel:+${normalizePhoneForWhatsApp(data.restaurant.whatsapp, countryCode)}`} className="inline-flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {t('Call', 'اتصال')}
                    </a>
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl border-slate-300 text-slate-600"
                onClick={() => setReportTarget('business')}
              >
                <Flag className="h-4 w-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                {t('Report business', 'الإبلاغ عن المتجر')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Driver contact */}
      {data.driver && (
        <div className="mt-6 px-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Truck className="h-5 w-5 text-slate-500" />
                {t('Your driver', 'السائق')}
              </h2>
            </div>
            <div className="p-4">
              <p className="font-medium text-slate-800">{data.driver.name}</p>
              <div className="mt-3 flex flex-wrap gap-3 items-center">
                <Button asChild size="sm" className="bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl">
                  <a href={getWhatsAppUrl(data.driver.phoneNumber, '', countryCode) || '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    {t('WhatsApp', 'واتساب')}
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm" className="rounded-xl border-slate-300">
                  <a href={`tel:+${normalizePhoneForWhatsApp(data.driver.phoneNumber, countryCode)}`} className="inline-flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {t('Call', 'اتصال')}
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-slate-300 text-slate-600"
                  onClick={() => setReportTarget('driver')}
                >
                  <Flag className="h-4 w-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                  {t('Report driver', 'الإبلاغ عن السائق')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {data.order.orderType === 'delivery' && data.order.deliveryAddress && (
        <div className="mt-6 px-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-2">
              <MapPin className="h-5 w-5 text-slate-500" />
              {t('Delivery address', 'عنوان التوصيل')}
            </h2>
            <p className="text-slate-600 text-sm">{data.order.deliveryAddress}</p>
          </div>
        </div>
      )}

      <div className="mt-8 px-4">
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-5">
          <p className="text-sm font-medium text-slate-700">
            {t('Save this link to check your order anytime', 'احفظ هذا الرابط لمتابعة طلبك في أي وقت')}
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={copyTrackLink} className="rounded-xl border-slate-300 shrink-0">
              {copied ? t('Copied!', 'تم النسخ!') : (<><Copy className="h-4 w-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" />{t('Copy link', 'نسخ الرابط')}</>)}
            </Button>
            {trackUrl && (
              <Button asChild variant="outline" size="sm" className="rounded-xl border-slate-300">
                <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5">
                  <ExternalLink className="h-4 w-4" />
                  {t('Open in new tab', 'فتح في نافذة جديدة')}
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      {reportTarget && data?.order?._id && (
        <ReportFormModal
          open={true}
          onClose={() => setReportTarget(null)}
          reporterType="customer"
          reportedType={reportTarget}
          orderId={data.order._id}
          slug={slug}
          trackingToken={token}
          onSuccess={() => setReportTarget(null)}
        />
      )}
    </div>
  )
}
