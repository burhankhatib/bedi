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
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type OrderStatus =
  | 'new'
  | 'preparing'
  | 'waiting_for_delivery'
  | 'driver_on_the_way'
  | 'out-for-delivery'
  | 'completed'
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
    driverPickedUpAt?: string | null
    estimatedDeliveryMinutes?: number | null
  }
  restaurant: { name_en?: string; name_ar?: string; whatsapp?: string } | null
  driver: { _id: string; name: string; phoneNumber: string } | null
  country?: string
}

function DeliveryETABoxSimple({
  order,
  driver,
  countryCode,
}: {
  order: TrackData['order']
  driver: TrackData['driver']
  countryCode: string
}) {
  const { t } = useLanguage()
  const [now, setNow] = useState(() => Date.now())

  const isActive = order.status === 'out-for-delivery' || order.status === 'driver_on_the_way'
  const isCompleted = order.status === 'completed'
  const showBox = (isActive || isCompleted) && order.orderType === 'delivery'

  useEffect(() => {
    if (!isActive) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isActive])

  if (!showBox) return null

  if (isCompleted && order.completedAt) {
    const deliveredAt = new Date(order.completedAt)
    const fmt = deliveredAt.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    const pickedUpMs = order.driverPickedUpAt ? new Date(order.driverPickedUpAt).getTime() : null
    const completedMs = deliveredAt.getTime()
    const deliveryMinutes = pickedUpMs ? Math.max(1, Math.round((completedMs - pickedUpMs) / 60000)) : null

    return (
      <div className="mt-6 px-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-emerald-900">{t('Delivered', 'تم التوصيل')}</p>
              {deliveryMinutes != null && (
                <p className="text-base font-bold text-emerald-700">
                  ⏱️ {deliveryMinutes <= 1
                    ? t('Less than a minute!', 'أقل من دقيقة!')
                    : t(`${deliveryMinutes} minutes`, `${deliveryMinutes} دقيقة`)}
                </p>
              )}
              <p className="text-sm text-emerald-600">{fmt}</p>
            </div>
          </div>
          {driver && (
            <p className="mt-2 text-sm text-emerald-800 ml-9">
              <span className="font-semibold">{t('Driver', 'السائق')}:</span> {driver.name}
            </p>
          )}
        </div>
      </div>
    )
  }

  const pickedUpAt = order.driverPickedUpAt ? new Date(order.driverPickedUpAt).getTime() : null
  const etaMinutes = order.estimatedDeliveryMinutes
  const hasCountdown = isActive && pickedUpAt && etaMinutes && order.status === 'out-for-delivery'

  let countdownMinutes = 0
  let countdownSeconds = 0
  let isOverdue = false

  if (hasCountdown) {
    const targetMs = pickedUpAt + etaMinutes * 60 * 1000
    const remainMs = targetMs - now
    if (remainMs <= 0) {
      isOverdue = true
    } else {
      countdownMinutes = Math.floor(remainMs / 60000)
      countdownSeconds = Math.floor((remainMs % 60000) / 1000)
    }
  }

  return (
    <div className="mt-6 px-4">
      <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
        <div className="flex items-center gap-3 mb-3">
          <Truck className="w-6 h-6 text-purple-600 shrink-0" />
          <p className="font-bold text-purple-900">
            {order.status === 'driver_on_the_way'
              ? t('Driver heading to the store', 'السائق في الطريق إلى المتجر')
              : t('On the way to you', 'في الطريق إليك')}
          </p>
        </div>
        {hasCountdown && (
          <div className="mb-3">
            {isOverdue ? (
              <p className="text-amber-700 font-semibold text-sm text-center py-2 bg-amber-50 rounded-xl border border-amber-200">
                {t('Arriving any moment now…', 'يصل في أي لحظة…')}
              </p>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <div className="bg-purple-100 rounded-xl px-4 py-2 text-center min-w-[70px]">
                  <span className="text-2xl font-black text-purple-800 tabular-nums block">
                    {String(countdownMinutes).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] font-bold text-purple-500 uppercase">{t('min', 'دقيقة')}</span>
                </div>
                <span className="text-xl font-black text-purple-400">:</span>
                <div className="bg-purple-100 rounded-xl px-4 py-2 text-center min-w-[70px]">
                  <span className="text-2xl font-black text-purple-800 tabular-nums block">
                    {String(countdownSeconds).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] font-bold text-purple-500 uppercase">{t('sec', 'ثانية')}</span>
                </div>
              </div>
            )}
          </div>
        )}
        {driver && (
          <div className="pt-3 border-t border-purple-200/60">
            <p className="font-semibold text-purple-900 mb-2">{driver.name}</p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`tel:+${normalizePhoneForWhatsApp(driver.phoneNumber, countryCode)}`}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 text-sm transition-colors"
              >
                <Phone className="h-4 w-4" />
                {t('Call', 'اتصال')}
              </a>
              {getWhatsAppUrl(driver.phoneNumber, '', countryCode) && (
                <a
                  href={getWhatsAppUrl(driver.phoneNumber, '', countryCode)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-2.5 text-sm transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const STATUS_CONFIG: Record<string, { labelEn: string; labelAr: string; icon: typeof ChefHat; headerBg: string; color: string; bg: string }> = {
  new: { labelEn: 'Order received', labelAr: 'تم استلام الطلب', icon: Package, headerBg: 'from-blue-600 to-blue-700', color: 'text-blue-600', bg: 'bg-blue-500/15' },
  preparing: { labelEn: 'Your order is being carefully prepared', labelAr: 'يتم تحضير طلبك بعناية', icon: ChefHat, headerBg: 'from-amber-600 to-amber-700', color: 'text-amber-600', bg: 'bg-amber-500/15' },
  waiting_for_delivery: { labelEn: 'Waiting for delivery', labelAr: 'في انتظار التوصيل', icon: Clock, headerBg: 'from-amber-600 to-amber-700', color: 'text-amber-600', bg: 'bg-amber-500/15' },
  driver_on_the_way: { labelEn: 'Driver on the way to the store', labelAr: 'السائق في الطريق إلى المتجر', icon: Truck, headerBg: 'from-blue-600 to-blue-700', color: 'text-blue-600', bg: 'bg-blue-500/15' },
  'out-for-delivery': { labelEn: 'Driver on the way to you', labelAr: 'السائق في الطريق إليك', icon: Truck, headerBg: 'from-purple-600 to-purple-700', color: 'text-purple-600', bg: 'bg-purple-500/15' },
  completed: { labelEn: 'Completed', labelAr: 'مكتمل', icon: CheckCircle2, headerBg: 'from-emerald-600 to-emerald-700', color: 'text-emerald-600', bg: 'bg-emerald-500/15' },
  cancelled: { labelEn: 'Cancelled', labelAr: 'ملغى', icon: Clock, headerBg: 'from-red-600 to-red-700', color: 'text-red-600', bg: 'bg-red-500/15' },
  refunded: { labelEn: 'Refunded', labelAr: 'مسترد', icon: CheckCircle2, headerBg: 'from-slate-600 to-slate-700', color: 'text-slate-600', bg: 'bg-slate-500/15' },
}
const DEFAULT_COUNTRY_CODE = '972'

export function OrderTrackClient({
  slug,
  orderId,
  phone,
}: {
  slug: string
  orderId: string
  phone: string
}) {
  const { t, lang } = useLanguage()
  const [data, setData] = useState<TrackData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const fetchTrack = useCallback(async (isRefetch = false) => {
    if (!slug || !orderId || !phone?.trim()) return
    if (!isRefetch) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch(
        `/api/tenants/${slug}/order/${orderId}/track?phone=${encodeURIComponent(phone)}`,
        { cache: 'no-store' }
      )
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
  }, [slug, orderId, phone, t])

  useEffect(() => {
    fetchTrack(false)
  }, [fetchTrack])

  usePusherStream(
    data?.order?._id ? `order-${data.order._id}` : null,
    'order-update',
    () => fetchTrack(true)
  )

  const trackUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/t/${slug}/order/${orderId}?phone=${encodeURIComponent(phone)}`
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
          <p className="mt-4 text-sm text-slate-400">
            {t('Make sure you opened the link from the same phone number you used to place the order.', 'تأكد من فتح الرابط من نفس رقم الهاتف الذي استخدمته عند الطلب.')}
          </p>
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
      ? data.driver?.name
        ? lang === 'ar'
          ? `السائق ${data.driver.name} في الطريق إلى ${restaurantName}`
          : `Driver ${data.driver.name} is on the way to ${restaurantName}`
        : lang === 'ar'
          ? `السائق في الطريق إلى ${restaurantName}`
          : `Driver is on the way to ${restaurantName}`
      : statusKey === 'out-for-delivery'
        ? data.driver?.name
          ? lang === 'ar'
            ? `${data.driver.name} في الطريق إليك`
            : `${data.driver.name} is on the way to you`
          : lang === 'ar'
            ? `السائق في الطريق إليك`
            : `Driver is on the way to you`
      : statusKey === 'new'
        ? lang === 'ar'
          ? `تم إرسال الطلب إلى ${restaurantName}`
          : `Order sent to ${restaurantName}`
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

      {/* Delivery ETA / Countdown box */}
      <DeliveryETABoxSimple
        order={data.order}
        driver={data.driver}
        countryCode={countryCode}
      />

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
            <div className="flex justify-between font-semibold text-slate-800 pt-1">
              <span>{t('Total', 'المجموع')}</span>
              <span>
                {data.order.totalAmount?.toFixed(2)} {formatCurrency(data.order.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

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
            <div className="p-4 flex flex-wrap gap-3">
              {data.restaurant.whatsapp && (
                <>
                  <Button
                    asChild
                    size="sm"
                    className="bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl"
                  >
                    <a
                      href={getWhatsAppUrl(data.restaurant.whatsapp, '', countryCode) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {t('WhatsApp', 'واتساب')}
                    </a>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-slate-300"
                  >
                    <a
                      href={`tel:+${normalizePhoneForWhatsApp(data.restaurant.whatsapp, countryCode)}`}
                      className="inline-flex items-center gap-2"
                    >
                      <Phone className="h-4 w-4" />
                      {t('Call', 'اتصال')}
                    </a>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Driver contact - when assigned */}
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
              {!['completed', 'cancelled', 'refunded'].includes(data.order.status ?? '') && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button
                    asChild
                    size="sm"
                    className="bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl"
                  >
                    <a
                      href={getWhatsAppUrl(data.driver.phoneNumber, '', countryCode) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {t('WhatsApp', 'واتساب')}
                    </a>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-slate-300"
                  >
                    <a
                      href={`tel:+${normalizePhoneForWhatsApp(data.driver.phoneNumber, countryCode)}`}
                      className="inline-flex items-center gap-2"
                    >
                      <Phone className="h-4 w-4" />
                      {t('Call', 'اتصال')}
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delivery address if delivery order */}
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

      {/* Save link / easy to reach */}
      <div className="mt-8 px-4">
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-5">
          <p className="text-sm font-medium text-slate-700">
            {t('Save this link to check your order anytime', 'احفظ هذا الرابط لمتابعة طلبك في أي وقت')}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyTrackLink}
              className="rounded-xl border-slate-300 shrink-0"
            >
              {copied ? (
                t('Copied!', 'تم النسخ!')
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                  {t('Copy link', 'نسخ الرابط')}
                </>
              )}
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
    </div>
  )
}
