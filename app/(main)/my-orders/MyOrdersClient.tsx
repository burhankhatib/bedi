'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CustomerProfileAvatarLink } from '@/components/customer/CustomerProfileAvatarLink'
import { useLanguage } from '@/components/LanguageContext'
import { Package, ChevronRight, Clock, Store } from 'lucide-react'
import {
  CustomerM3Card,
  CustomerM3Content,
  CustomerM3FilledLink,
  CustomerM3MotionSection,
  CustomerM3OutlinedLink,
  CustomerM3PageScaffold,
  CustomerM3TopAppBar,
  CustomerM3TonalLink,
} from '@/components/customer/CustomerM3AccountChrome'
import { OrderRatingPrompt } from '@/components/rating/OrderRatingPrompt'

const BROWSE_RESTAURANTS = '/search?category=restaurant'
const BROWSE_STORES = '/search?category=stores'

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
  scheduledFor?: string
}

const ACTIVE_STATUSES = new Set([
  'new',
  'acknowledged',
  'preparing',
  'waiting_for_delivery',
  'driver_on_the_way',
  'out-for-delivery',
])

const STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  new: { en: 'Received', ar: 'مستلم' },
  acknowledged: { en: 'Scheduled', ar: 'مجدول' },
  preparing: { en: 'Preparing', ar: 'قيد التحضير' },
  waiting_for_delivery: { en: 'Waiting for delivery', ar: 'في انتظار التوصيل' },
  driver_on_the_way: { en: 'Driver on the way', ar: 'السائق في الطريق' },
  'out-for-delivery': { en: 'On the way to you', ar: 'في الطريق إليك' },
  completed: { en: 'Completed', ar: 'مكتمل' },
  cancelled: { en: 'Cancelled', ar: 'ملغي' },
  refunded: { en: 'Refunded', ar: 'مسترد' },
}

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
  const isRtl = lang === 'ar'
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
    <CustomerM3PageScaffold dir={isRtl ? 'rtl' : 'ltr'}>
      <CustomerM3TopAppBar
        title={t('My orders', 'طلباتي')}
        backHref="/profile"
        backLabel={t('Back to profile', 'العودة للحساب')}
        isRtl={isRtl}
        trailing={
          <CustomerProfileAvatarLink
            size="md"
            ariaLabel={t('My profile', 'حسابي')}
            className="ring-offset-2 ring-offset-[color:var(--m3-surface-container-high)]"
          />
        }
      />

      <CustomerM3Content className="space-y-6">
        <CustomerM3MotionSection>
          <p className="mb-4 text-sm leading-relaxed md:text-base" style={{ color: 'var(--m3-on-surface-variant)' }}>
            {t(
              'Active orders and history from all businesses.',
              'الطلبات النشطة والسابقة من جميع المتاجر.'
            )}
          </p>

          <div
            className="mb-6 flex h-12 rounded-full p-1 md:h-14 md:p-1.5"
            style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
            role="tablist"
            aria-label={t('Order list', 'قائمة الطلبات')}
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'active'}
              onClick={() => setTab('active')}
              className="flex-1 rounded-full text-sm font-semibold transition-colors duration-200 md:text-base"
              style={
                tab === 'active'
                  ? {
                      backgroundColor: 'var(--m3-primary-container)',
                      color: 'var(--m3-on-primary-container)',
                      boxShadow: 'var(--m3-elevation-1)',
                    }
                  : { color: 'var(--m3-on-surface-variant)' }
              }
            >
              {t('Active', 'نشطة')} ({active.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'history'}
              onClick={() => setTab('history')}
              className="flex-1 rounded-full text-sm font-semibold transition-colors duration-200 md:text-base"
              style={
                tab === 'history'
                  ? {
                      backgroundColor: 'var(--m3-primary-container)',
                      color: 'var(--m3-on-primary-container)',
                      boxShadow: 'var(--m3-elevation-1)',
                    }
                  : { color: 'var(--m3-on-surface-variant)' }
              }
            >
              {t('History', 'السابقة')} ({history.length})
            </button>
          </div>
        </CustomerM3MotionSection>

        {tab === 'active' && (
          <CustomerM3MotionSection delay={0.03}>
            {active.length === 0 ? (
              <EmptyState
                icon={Package}
                title={t('No active orders.', 'لا توجد طلبات نشطة.')}
                hint={t(
                  'Browse restaurants and stores to place an order.',
                  'تصفح المطاعم والمتاجر لإتمام طلب.'
                )}
                t={t}
              />
            ) : (
              <ul className="space-y-3 md:space-y-4">
                {active.map((order) => (
                  <OrderCard
                    key={order._id}
                    order={order}
                    isActive
                    locale={lang}
                    t={t}
                    statusLabel={statusLabel}
                    formatDate={formatDate}
                    formatAmount={formatAmount}
                  />
                ))}
              </ul>
            )}
          </CustomerM3MotionSection>
        )}

        {tab === 'history' && (
          <CustomerM3MotionSection delay={0.03}>
            {history.length === 0 ? (
              <EmptyState
                icon={Clock}
                title={t('No order history yet.', 'لا توجد طلبات سابقة بعد.')}
                hint={t(
                  'Completed and cancelled orders appear here.',
                  'تظهر الطلبات المكتملة والملغاة هنا.'
                )}
                t={t}
              />
            ) : (
              <ul className="space-y-3 md:space-y-4">
                {history.map((order) => (
                  <OrderCard
                    key={order._id}
                    order={order}
                    isActive={false}
                    locale={lang}
                    t={t}
                    statusLabel={statusLabel}
                    formatDate={formatDate}
                    formatAmount={formatAmount}
                  />
                ))}
              </ul>
            )}
          </CustomerM3MotionSection>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4 pb-6 text-sm font-semibold">
          <Link
            href="/profile"
            className="underline-offset-4 hover:underline"
            style={{ color: 'var(--m3-primary)' }}
          >
            {t('Profile', 'حسابي')}
          </Link>
          <span style={{ color: 'var(--m3-outline-variant)' }} aria-hidden>
            ·
          </span>
          <Link
            href="/"
            className="underline-offset-4 hover:underline"
            style={{ color: 'var(--m3-primary)' }}
          >
            {t('Home', 'الرئيسية')}
          </Link>
        </div>
      </CustomerM3Content>
    </CustomerM3PageScaffold>
  )
}

function EmptyState({
  icon: Icon,
  title,
  hint,
  t,
}: {
  icon: typeof Package
  title: string
  hint: string
  t: (en: string, ar: string) => string
}) {
  return (
    <CustomerM3Card>
      <div className="flex flex-col items-center px-2 py-6 text-center md:py-8">
        <Icon
          className="mb-4 size-14 opacity-50"
          style={{ color: 'var(--m3-on-surface-variant)' }}
        />
        <p className="text-base font-semibold" style={{ color: 'var(--m3-on-surface)' }}>
          {title}
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed" style={{ color: 'var(--m3-on-surface-variant)' }}>
          {hint}
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <CustomerM3FilledLink href={BROWSE_RESTAURANTS}>
            {t('Browse restaurants', 'تصفح المطاعم')}
          </CustomerM3FilledLink>
          <CustomerM3TonalLink href={BROWSE_STORES}>
            {t('Browse stores', 'تصفح المتاجر')}
          </CustomerM3TonalLink>
        </div>
      </div>
    </CustomerM3Card>
  )
}

function OrderCard({
  order,
  isActive,
  locale,
  t,
  statusLabel,
  formatDate: fmtDate,
  formatAmount: fmtAmount,
}: {
  order: MyOrderRow
  isActive: boolean
  locale: 'en' | 'ar'
  t: (en: string, ar: string) => string
  statusLabel: (s: string | undefined) => string
  formatDate: (iso: string | undefined) => string
  formatAmount: (a: number | undefined, c: string | undefined) => string
}) {
  const trackHref =
    order.siteSlug && order.trackingToken
      ? `/t/${order.siteSlug}/track/${order.trackingToken}`
      : null
  const businessName = order.siteName?.trim() || order.siteSlug || t('Order', 'طلب')

  return (
    <li>
      <CustomerM3Card
        className={isActive ? 'ring-2 ring-[color:var(--m3-primary)]/25' : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div
              className="mb-1 flex items-center gap-2 text-sm font-medium"
              style={{ color: 'var(--m3-on-surface-variant)' }}
            >
              <Store className="size-4 shrink-0" />
              <span className="truncate">{businessName}</span>
            </div>
            <p className="text-lg font-bold tracking-tight" style={{ color: 'var(--m3-on-surface)' }}>
              #{order.orderNumber || order._id.slice(-6)}
            </p>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--m3-on-surface-variant)' }}>
              {statusLabel(order.status)} · {fmtDate(order.createdAt)}
            </p>
            {order.scheduledFor && (
              <div
                className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold"
                style={{
                  backgroundColor: 'var(--m3-secondary-container)',
                  color: 'var(--m3-on-secondary-container)',
                }}
              >
                <Clock className="size-3.5" />
                {new Date(order.scheduledFor).toLocaleString(locale === 'ar' ? 'ar' : 'en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </div>
            )}
            <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--m3-on-surface)' }}>
              {fmtAmount(order.totalAmount, order.currency)}
            </p>
            {(order.status === 'completed' || order.status === 'served') && (
              <div className="mt-4">
                <OrderRatingPrompt orderId={order._id} raterRole="customer" targetName={businessName} />
              </div>
            )}
          </div>
          {trackHref ? (
            <CustomerM3OutlinedLink href={trackHref} className="h-9 shrink-0 gap-1 px-3 text-xs">
              {t('Track', 'تتبع')}
              <ChevronRight className="size-3.5 rtl:rotate-180" />
            </CustomerM3OutlinedLink>
          ) : null}
        </div>
      </CustomerM3Card>
    </li>
  )
}
