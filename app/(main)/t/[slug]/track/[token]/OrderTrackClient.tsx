'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useLanguage } from '@/components/LanguageContext'
import { usePusherStream } from '@/lib/usePusherStream'
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
  LocateFixed,
  ChevronDown,
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
    preparedAt?: string | null
    driverAcceptedAt?: string | null
    driverPickedUpAt?: string | null
    cancelledAt?: string | null
    driverCancelledAt?: string | null
    completedAt?: string | null
    tipPercent?: number
    tipAmount?: number
    customerRequestedAt?: string | null
    customerRequestAcknowledgedAt?: string | null
    scheduledFor?: string | null
    scheduleEditHistory?: Array<{
      previousScheduledFor: string
      changedAt: string
    }>
  }
  restaurant: { name_en?: string; name_ar?: string; whatsapp?: string } | null
  driver: { _id: string; name: string; phoneNumber: string } | null
  country?: string
}

/** Allows customer to share GPS location so driver can navigate to their address. */
function CustomerLocationShare({ orderId, trackingToken }: { orderId: string; trackingToken: string }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [saved, setSaved] = useState<{ lat: number; lng: number } | null>(null)

  const shareLocation = () => {
    if (!navigator.geolocation) {
      showToast('Location not supported in this browser.', 'الموقع غير مدعوم في هذا المتصفح.', 'error')
      return
    }
    setState('loading')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        try {
          const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackingToken, lat, lng }),
          })
          if (!res.ok) throw new Error('Failed')
          setSaved({ lat, lng })
          setState('done')
          showToast('تم مشاركة موقعك مع السائق!', undefined, 'success')
        } catch {
          setState('idle')
          showToast('فشل مشاركة الموقع. حاول مرة أخرى.', undefined, 'error')
        }
      },
      (err) => {
        setState('idle')
        if (err.code === 1) {
          showToast(
            'Location access denied. Enable it in device settings.',
            'تم رفض الوصول للموقع. فعّله من إعدادات الجهاز.',
            'error'
          )
        } else {
          showToast('Could not get location. Try again.', 'تعذّر تحديد الموقع. حاول مرة أخرى.', 'error')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-blue-900 flex items-center gap-1.5">
          <LocateFixed className="h-4 w-4 shrink-0" />
          {state === 'done'
            ? t('Location shared with driver', 'تم مشاركة موقعك مع السائق')
            : t('Share your location with driver', 'شارك موقعك مع السائق')}
        </p>
        {saved ? (
          <p className="mt-0.5 text-xs text-blue-700">{saved.lat.toFixed(5)}, {saved.lng.toFixed(5)}</p>
        ) : (
          <p className="mt-0.5 text-xs text-blue-700">
            {t('Helps the driver navigate directly to you.', 'يساعد السائق للوصول إليك مباشرةً.')}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={shareLocation}
        disabled={state === 'loading'}
        className="shrink-0 flex items-center gap-1.5 rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:opacity-50"
      >
        <LocateFixed className={`h-3.5 w-3.5 ${state === 'loading' ? 'animate-pulse' : ''}`} />
        {state === 'loading'
          ? t('Getting…', 'جاري…')
          : state === 'done'
            ? t('Update', 'تحديث')
            : t('Share', 'مشاركة')}
      </button>
    </div>
  )
}

const STATUS_CONFIG: Record<string, { labelEn: string; labelAr: string; icon: typeof ChefHat; headerBg: string; headerFrom: string; headerTo: string }> = {
  new: { labelEn: 'Order received', labelAr: 'تم استلام الطلب', icon: Package, headerBg: 'from-blue-600 to-blue-700', headerFrom: 'from-blue-600', headerTo: 'to-blue-700' },
  acknowledged: { labelEn: 'Order scheduled', labelAr: 'تم جدولة الطلب', icon: Clock, headerBg: 'from-purple-600 to-purple-700', headerFrom: 'from-purple-600', headerTo: 'to-purple-700' },
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
  const [restaurantOpen, setRestaurantOpen] = useState(false)
  const [driverOpen, setDriverOpen] = useState(false)

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

  usePusherStream(
    data?.order?._id ? `order-${data.order._id}` : null,
    'order-update',
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
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-md hover:bg-slate-50 transition-colors"
          aria-label={t('Back to menu', 'العودة إلى القائمة')}
        >
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </Link>
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

      {data.order.scheduledFor && data.order.status !== 'completed' && data.order.status !== 'cancelled' && data.order.status !== 'refunded' && (
        <div className="mt-6 px-4">
          <div className="rounded-3xl border border-purple-200 bg-purple-50 p-5 shadow-sm relative overflow-hidden">
            <div className="absolute -right-6 -top-6 text-purple-200/50 pointer-events-none">
              <Clock className="w-32 h-32" />
            </div>
            <div className="flex items-center gap-3 mb-2 relative z-10">
              <div className="bg-purple-600 p-2 rounded-xl text-white">
                <Clock className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black text-purple-900">
                {t('Scheduled Order', 'طلب مجدول')}
              </h2>
            </div>
            <p className="text-purple-800 font-medium relative z-10">
              {t('Scheduled for:', 'مجدول ليوم:')} {new Date(data.order.scheduledFor).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
            </p>
          </div>
        </div>
      )}

      {/* Order details */}
      <div className="mt-6 px-4">
        <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-400" />
              {t('Activity Timeline', 'سجل النشاطات')}
            </h2>
          </div>
          <div className="p-5">
            {(() => {
              const fmt = (iso: string) =>
                new Date(iso).toLocaleString('en-US', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })
              return (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 rtl:before:ml-0 rtl:before:mr-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                  {/* 1. Order received — always shown */}
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-slate-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                    <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-slate-50 shadow-sm border border-slate-100 flex flex-col">
                      <p className="text-xs font-bold text-slate-800">{t('Order received', 'تم استلام الطلب')}</p>
                      {data.order.createdAt && <p className="text-xs text-slate-500 mt-1">{fmt(data.order.createdAt)}</p>}
                    </div>
                  </div>

                  {/* Schedule Edits (if any) */}
                  {(data.order.scheduleEditHistory || []).map((edit, idx) => (
                    <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-purple-300 bg-purple-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-purple-50/50 shadow-sm border border-purple-100 flex flex-col">
                        <p className="text-xs font-bold text-purple-800 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {t('Scheduled time updated', 'تم تحديث وقت الجدولة')}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {t('Previously:', 'سابقاً:')} {fmt(edit.previousScheduledFor)}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 border-t border-purple-100 pt-0.5">
                          {fmt(edit.changedAt)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* 2. Order ready (optional) */}
                  {data.order.preparedAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-slate-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-white shadow-sm border border-slate-100 flex flex-col">
                        <p className="text-xs font-bold text-slate-800">{t('Order is ready', 'الطلب جاهز')}</p>
                        <p className="text-xs text-slate-500 mt-1">{fmt(data.order.preparedAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* 3. Driver on the way to business */}
                  {data.order.driverAcceptedAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-slate-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-white shadow-sm border border-slate-100 flex flex-col">
                        <p className="text-xs font-bold text-slate-800">{t('Driver on the way to business', 'السائق في الطريق إلى المتجر')}</p>
                        <p className="text-xs text-slate-500 mt-1">{fmt(data.order.driverAcceptedAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* 4. Order picked up / on the way to client */}
                  {data.order.driverPickedUpAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-slate-300 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-white shadow-sm border border-slate-100 flex flex-col">
                        <p className="text-xs font-bold text-slate-800">{t('Order picked up — on the way to you', 'تم استلام الطلب — في الطريق إليك')}</p>
                        <p className="text-xs text-slate-500 mt-1">{fmt(data.order.driverPickedUpAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* 5. Order delivered / completed */}
                  {data.order.completedAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-emerald-300 bg-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-emerald-50 shadow-sm border border-emerald-100 flex flex-col">
                        <p className="text-xs font-bold text-emerald-800">{t('Order delivered / completed', 'تم التوصيل / مكتمل')}</p>
                        <p className="text-xs text-emerald-600 mt-1">{fmt(data.order.completedAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* Order cancelled */}
                  {data.order.cancelledAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-red-300 bg-red-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-red-50 shadow-sm border border-red-100 flex flex-col">
                        <p className="text-xs font-bold text-red-800">{t('Order cancelled', 'تم إلغاء الطلب')}</p>
                        <p className="text-xs text-red-600 mt-1">{fmt(data.order.cancelledAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* Driver cancelled delivery */}
                  {data.order.driverCancelledAt && (
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-amber-300 bg-amber-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-amber-50 shadow-sm border border-amber-100 flex flex-col">
                        <p className="text-xs font-bold text-amber-800">{t('Driver cancelled delivery', 'السائق ألغى التوصيل')}</p>
                        <p className="text-xs text-amber-600 mt-1">{fmt(data.order.driverCancelledAt)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Order details */}
      <div className="mt-6 px-4">
        <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-slate-400" />
              {t('Order details', 'تفاصيل الطلب')}
            </h2>
          </div>
          <ul className="divide-y divide-slate-100/80 px-2">
            {(data.order.items ?? []).map((item, i) => (
              <li key={i} className="flex justify-between gap-4 px-3 py-4 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{item.productName}</p>
                  {(item.notes || item.addOns) && (
                    <p className="text-xs text-slate-500 mt-1 truncate">{[item.notes, item.addOns].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <span className="shrink-0 text-slate-600 font-medium bg-slate-50 px-2 py-1 rounded-lg self-start">
                  {item.quantity} × {item.price?.toFixed(2)} {formatCurrency(data.order.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="bg-slate-50/50 px-5 py-4 space-y-2.5">
            <div className="flex justify-between text-slate-600 text-sm">
              <span>{t('Subtotal', 'المجموع الفرعي')}</span>
              <span className="font-medium">{(data.order.subtotal ?? 0).toFixed(2)} {formatCurrency(data.order.currency)}</span>
            </div>
            {isDelivery && deliveryFee > 0 && (
              <div className="flex justify-between text-slate-600 text-sm">
                <span>{t('Delivery', 'التوصيل')}</span>
                <span className="font-medium">{deliveryFee.toFixed(2)} {formatCurrency(data.order.currency)}</span>
              </div>
            )}
            {tipEnabled && tipAmount > 0 && (
              <div className="flex justify-between text-slate-600 text-sm">
                <span>{t('Tip', 'إكرامية')} ({tipPercent}%)</span>
                <span className="font-medium">{tipAmount.toFixed(2)} {formatCurrency(data.order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200/60 text-lg">
              <span>{t('Total', 'المجموع')}</span>
              <span>
                {displayTotal.toFixed(2)} {formatCurrency(data.order.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tips option — under total */}
      <div className="mt-5 px-4">
        <div className="rounded-3xl border border-rose-100 bg-rose-50/30 shadow-sm overflow-hidden transition-all duration-300">
          <label className="flex items-center justify-between cursor-pointer px-5 py-4 select-none">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-500">
                <Heart className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">
                  {t('Add a tip?', 'إضافة إكرامية؟')}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('Support the team', 'ادعم الفريق')}
                </p>
              </div>
            </div>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={tipEnabled}
                onChange={(e) => handleTipToggle(e.target.checked)}
                className="peer sr-only"
              />
              <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-rose-500 peer-checked:after:translate-x-full peer-checked:after:border-white rtl:peer-checked:after:-translate-x-full"></div>
            </div>
          </label>
          
          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${tipEnabled ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden">
              <div className="px-5 pb-5 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  {[5, 10, 15, 20, 25].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleTipPercentChange(p)}
                      className={`flex-1 min-w-[3.5rem] py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-95 ${
                        tipPercent === p
                          ? 'bg-rose-500 text-white shadow-md shadow-rose-200'
                          : 'bg-white text-slate-600 border border-slate-200 hover:border-rose-200 hover:bg-rose-50'
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Split the bill — local only, friendly */}
      <div className="mt-5 px-4">
        <div className="rounded-3xl border border-amber-200/60 bg-gradient-to-b from-amber-50 to-white shadow-sm overflow-hidden p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-amber-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-500" />
                {t('Split the bill', 'تقسيم الفاتورة')}
              </h2>
              <p className="text-xs text-amber-700/80 mt-1 max-w-[200px] leading-relaxed">
                {t('Dividing among friends? Choose how many people.', 'تقسمون بين الأصدقاء؟ اختروا عدد الأشخاص.')}
              </p>
            </div>
            
            <div className="flex items-center rounded-2xl border border-amber-200 bg-white p-1 shadow-sm shrink-0">
              <button
                type="button"
                onClick={() => setSplitPeople((n) => Math.max(1, n - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-amber-600 hover:bg-amber-50 active:bg-amber-100 transition-colors"
                aria-label={t('Decrease', 'إنقاص')}
              >
                <span className="text-xl leading-none -mt-0.5">−</span>
              </button>
              <span className="min-w-[2.5rem] text-center font-bold text-amber-900">{splitPeople}</span>
              <button
                type="button"
                onClick={() => setSplitPeople((n) => n + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-amber-600 hover:bg-amber-50 active:bg-amber-100 transition-colors"
                aria-label={t('Increase', 'زيادة')}
              >
                <span className="text-xl leading-none -mt-0.5">+</span>
              </button>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-amber-200/50 flex items-center justify-between">
            <span className="text-sm font-medium text-amber-800">{t('Each person pays', 'كل شخص يدفع')}:</span>
            <span className="text-lg font-black text-amber-600">
              {perPerson.toFixed(2)} <span className="text-sm">{formatCurrency(currency)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Dine-in: Call waiter / Ask for check — hidden only when order is completed (paid/done) */}
      {isDineIn && data.order.status !== 'completed' && (
        <div className="mt-5 px-4">
          <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-slate-400" />
                {t('Need something?', 'تحتاج شيئاً؟')}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {t('We\'ll let the staff know right away.', 'سنخبر الطاقم فوراً.')}
              </p>
              {data.order.customerRequestedAt && !data.order.customerRequestAcknowledgedAt && (
                <p className="mt-3 text-sm font-medium text-amber-700 bg-amber-50 rounded-xl px-4 py-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 animate-pulse" />
                  {t('Request sent — waiting for staff to respond.', 'تم إرسال الطلب — في انتظار رد الطاقم.')}
                </p>
              )}
            </div>
            <div className="p-5 flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={requestSending}
                onClick={() => sendRequest('call_waiter')}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-2xl h-12 flex-1 shadow-sm"
              >
                <HandHelping className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                {t('Call the waiter', 'استدعاء النادل')}
              </Button>
              <Button
                type="button"
                disabled={requestSending}
                onClick={() => setShowCheckModal(true)}
                variant="outline"
                className="rounded-2xl border-slate-200 h-12 flex-1 text-slate-700 hover:bg-slate-50"
              >
                <CreditCard className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                {t('Ask for the check', 'طلب الفاتورة')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ask for check — Cash or Card */}
      {showCheckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCheckModal(false)}>
        <div className="rounded-3xl border border-slate-200/60 bg-white shadow-md max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
          <h3 className="font-bold text-slate-800 text-lg mb-1">{t('How would you like to pay?', 'كيف تفضل الدفع؟')}</h3>
          <p className="text-sm text-slate-500 mb-5">{t('Select your preferred payment method.', 'اختر طريقة الدفع المفضلة.')}</p>
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={() => sendRequest('request_check', 'cash')}
              disabled={requestSending}
              className="flex-1 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 h-12 shadow-sm"
            >
              <Banknote className="mr-2 h-5 w-5 rtl:ml-2 rtl:mr-0" />
              {t('Cash', 'نقداً')}
            </Button>
            <Button
              type="button"
              onClick={() => sendRequest('request_check', 'card')}
              disabled={requestSending}
              className="flex-1 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white h-12 shadow-sm"
            >
              <Coins className="mr-2 h-5 w-5 rtl:ml-2 rtl:mr-0" />
              {t('Card', 'بطاقة')}
            </Button>
          </div>
          <Button type="button" variant="ghost" className="mt-4 w-full rounded-2xl h-12" onClick={() => setShowCheckModal(false)}>
            {t('Cancel', 'إلغاء')}
          </Button>
        </div>
        </div>
      )}

      {/* Business contact */}
      {data.restaurant && (data.restaurant.whatsapp || data.restaurant.name_en || data.restaurant.name_ar) && (
        <div className="mt-5 px-4">
          <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden transition-all duration-300">
            <button
              type="button"
              onClick={() => setRestaurantOpen(!restaurantOpen)}
              className="w-full flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4 focus:outline-none"
            >
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Store className="h-5 w-5 text-slate-400" />
                {restaurantName}
              </h2>
              <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${restaurantOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${restaurantOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                <div className="p-5 flex flex-wrap gap-3 items-center">
                  {data.restaurant.whatsapp && (
                    <>
                      <Button asChild size="sm" className="bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl h-10 shadow-sm">
                        <a href={getWhatsAppUrl(data.restaurant.whatsapp, '', countryCode) || '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-1">
                          <MessageCircle className="h-4 w-4" />
                          {t('WhatsApp', 'واتساب')}
                        </a>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="rounded-xl border-slate-200 h-10 text-slate-700 hover:bg-slate-50">
                        <a href={`tel:+${normalizePhoneForWhatsApp(data.restaurant.whatsapp, countryCode)}`} className="inline-flex items-center gap-2 px-1">
                          <Phone className="h-4 w-4" />
                          {t('Call', 'اتصال')}
                        </a>
                      </Button>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-slate-500 hover:bg-slate-100 h-10 ml-auto rtl:mr-auto rtl:ml-0"
                    onClick={() => setReportTarget('business')}
                  >
                    <Flag className="h-4 w-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                    {t('Report', 'إبلاغ')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Driver contact */}
      {data.driver && (
        <div className="mt-5 px-4">
          <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden transition-all duration-300">
            <button
              type="button"
              onClick={() => setDriverOpen(!driverOpen)}
              className="w-full flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4 focus:outline-none"
            >
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Truck className="h-5 w-5 text-slate-400" />
                {t('Your driver', 'السائق')}
              </h2>
              <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${driverOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${driverOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                <div className="p-5">
                  <p className="font-medium text-slate-800 mb-3">{data.driver.name}</p>
                  <div className="flex flex-wrap gap-3 items-center">
                    {!['completed', 'cancelled', 'refunded'].includes(data.order.status ?? '') && (
                      <>
                        <Button asChild size="sm" className="bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl h-10 shadow-sm">
                          <a href={getWhatsAppUrl(data.driver.phoneNumber, '', countryCode) || '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-1">
                            <MessageCircle className="h-4 w-4" />
                            {t('WhatsApp', 'واتساب')}
                          </a>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="rounded-xl border-slate-200 h-10 text-slate-700 hover:bg-slate-50">
                          <a href={`tel:+${normalizePhoneForWhatsApp(data.driver.phoneNumber, countryCode)}`} className="inline-flex items-center gap-2 px-1">
                            <Phone className="h-4 w-4" />
                            {t('Call', 'اتصال')}
                          </a>
                        </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-slate-500 hover:bg-slate-100 h-10 ml-auto rtl:mr-auto rtl:ml-0"
                      onClick={() => setReportTarget('driver')}
                    >
                      <Flag className="h-4 w-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                      {t('Report', 'إبلاغ')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {data.order.orderType === 'delivery' && data.order.deliveryAddress && (
        <div className="mt-5 px-4">
          <div className="rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
              <MapPin className="h-5 w-5 text-slate-400" />
              {t('Delivery address', 'عنوان التوصيل')}
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">{data.order.deliveryAddress}</p>
          </div>
        </div>
      )}

      <div className="mt-8 px-4">
        <div className="rounded-3xl border-2 border-dashed border-slate-200/80 bg-slate-50/50 p-6">
          <p className="text-sm font-medium text-slate-700">
            {t('Save this link to check your order anytime', 'احفظ هذا الرابط لمتابعة طلبك في أي وقت')}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={copyTrackLink} className="rounded-2xl border-slate-200 h-10 shadow-sm shrink-0 hover:bg-slate-100">
              {copied ? t('Copied!', 'تم النسخ!') : (<><Copy className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />{t('Copy link', 'نسخ الرابط')}</>)}
            </Button>
            {trackUrl && (
              <Button asChild variant="outline" size="sm" className="rounded-2xl border-slate-200 h-10 shadow-sm hover:bg-slate-100">
                <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  {t('Open in new tab', 'فتح في نافذة جديدة')}
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 px-4 border-t border-slate-200/60 pt-8 space-y-4">
        <div className="px-2">
          <h3 className="font-bold text-slate-800 text-sm mb-1">{t('Device Settings', 'إعدادات الجهاز')}</h3>
          <p className="text-xs text-slate-500 mb-4">
            {t('Enable notifications to stay updated, and share your location to help the driver find you faster.', 'فعّل الإشعارات لتصلك التحديثات، وشارك موقعك لمساعدة السائق في الوصول إليك أسرع.')}
          </p>
        </div>
        <CustomerTrackPushSetup slug={slug} token={token} />
        {isDelivery && !['completed', 'cancelled', 'refunded'].includes(data.order.status ?? '') && (
          <CustomerLocationShare orderId={data.order._id} trackingToken={token} />
        )}
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
