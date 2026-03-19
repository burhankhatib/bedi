'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { UserProfile, useClerk } from '@clerk/nextjs'
import {
  ChevronRight,
  Package,
  Pencil,
  Store,
  AlertTriangle,
  Phone,
  Mail,
  LogOut,
} from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MyOrderRow } from '@/app/(main)/my-orders/MyOrdersClient'
import type {
  CustomerProfileApiClerk,
  CustomerProfileApiCustomer,
} from '@/app/api/customer/profile/route'
import {
  CustomerM3Card,
  CustomerM3Content,
  CustomerM3FilledLink,
  CustomerM3MotionSection,
  CustomerM3OutlinedLink,
  CustomerM3PageScaffold,
  CustomerM3SectionTitle,
  CustomerM3TopAppBar,
  CustomerM3TonalLink,
} from '@/components/customer/CustomerM3AccountChrome'

const BROWSE_HREF = '/search?category=restaurant'

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

type Props = {
  initialCustomer: CustomerProfileApiCustomer | null
  initialClerk: CustomerProfileApiClerk
  initialOrders: MyOrderRow[]
}

export function ProfileClient({ initialCustomer, initialClerk, initialOrders }: Props) {
  const { t, lang } = useLanguage()
  const { signOut } = useClerk()
  const isRtl = lang === 'ar'
  const [customer, setCustomer] = useState<CustomerProfileApiCustomer | null>(initialCustomer)
  const [clerk, setClerk] = useState<CustomerProfileApiClerk>(initialClerk)
  const [orders, setOrders] = useState<MyOrderRow[]>(initialOrders)

  const defaultName = useMemo(() => {
    const n = customer?.name?.trim()
    if (n) return n
    if (clerk.fullName?.trim()) return clerk.fullName.trim()
    return ''
  }, [customer?.name, clerk.fullName])

  const [name, setName] = useState(defaultName)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)

  useEffect(() => {
    if (!editing) setName(defaultName)
  }, [defaultName, editing])

  useEffect(() => {
    if (!saveOk) return
    const tmr = window.setTimeout(() => setSaveOk(false), 4000)
    return () => window.clearTimeout(tmr)
  }, [saveOk])

  const emailDisplay = clerk.email ?? customer?.email ?? '—'
  const phoneDisplay = clerk.phone ?? customer?.primaryPhone ?? '—'

  const statusLabel = (status: string | undefined) => {
    if (!status) return '—'
    const s = STATUS_LABELS[status]
    return s ? (lang === 'ar' ? s.ar : s.en) : status
  }

  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/customer/profile')
      if (!res.ok) return
      const data = (await res.json()) as {
        customer: CustomerProfileApiCustomer | null
        clerk: CustomerProfileApiClerk
      }
      setCustomer(data.customer ?? null)
      if (data.clerk) setClerk(data.clerk)
    } catch {
      /* ignore */
    }
  }, [])

  const refreshOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/me/orders')
      if (!res.ok) return
      const data = (await res.json()) as { orders?: MyOrderRow[] }
      const list = data.orders ?? []
      setOrders(list.slice(0, 8))
    } catch {
      /* ignore */
    }
  }, [])

  const handleSave = async () => {
    setFormError(null)
    setSaveOk(false)
    const trimmed = name.trim().replace(/\s+/g, ' ')
    if (!trimmed || trimmed.length > 120) {
      setFormError(t('Enter a valid name (1–120 characters).', 'أدخل اسماً صالحاً (1–120 حرفاً).'))
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFormError(
          typeof body.error === 'string'
            ? body.error
            : t('Could not save. Try again.', 'تعذّر الحفظ. حاول مجدداً.')
        )
        return
      }
      setSaveOk(true)
      setEditing(false)
      await refreshProfile()
      await refreshOrders()
    } finally {
      setSaving(false)
    }
  }

  const previewOrders = orders.slice(0, 5)

  return (
    <CustomerM3PageScaffold dir={isRtl ? 'rtl' : 'ltr'}>
      <CustomerM3TopAppBar
        title={t('Profile', 'حسابي')}
        backHref="/"
        backLabel={t('Back to home', 'العودة للرئيسية')}
        isRtl={isRtl}
        trailing={
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: '/' })}
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full text-[color:var(--m3-on-surface)] transition-colors hover:bg-black/[0.06] active:bg-black/[0.1] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[color:var(--m3-primary)] focus-visible:ring-offset-2"
            aria-label={t('Sign out', 'تسجيل الخروج')}
          >
            <LogOut className="size-5 shrink-0" strokeWidth={2} />
          </button>
        }
      />

      <CustomerM3Content className="space-y-6">
        {customer?.blockedBySuperAdmin ? (
          <CustomerM3MotionSection>
            <div
              className="flex gap-3 rounded-2xl border-2 p-4 md:p-5"
              style={{
                backgroundColor: 'var(--m3-error-container)',
                borderColor: 'var(--m3-outline-variant)',
              }}
              role="alert"
            >
              <AlertTriangle
                className="size-5 shrink-0"
                style={{ color: 'var(--m3-on-error-container)' }}
              />
              <p
                className="text-sm font-medium leading-relaxed"
                style={{ color: 'var(--m3-on-error-container)' }}
              >
                {t(
                  'Your account cannot place new orders. Contact support if you believe this is a mistake.',
                  'لا يمكن لحسابك تقديم طلبات جديدة. تواصل مع الدعم إذا كان ذلك خطأ.'
                )}
              </p>
            </div>
          </CustomerM3MotionSection>
        ) : null}

        <CustomerM3MotionSection delay={0.02}>
          <CustomerM3Card>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <CustomerM3SectionTitle
                title={t('Order name', 'الاسم على الطلبات')}
                subtitle={t(
                  'Update how your name appears on orders.',
                  'تحديث الاسم الذي يظهر على طلباتك.'
                )}
              />
              {!editing ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 gap-2 rounded-full border-2 px-4"
                  style={{
                    borderColor: 'var(--m3-outline)',
                    color: 'var(--m3-primary)',
                  }}
                  onClick={() => {
                    setEditing(true)
                    setSaveOk(false)
                    setFormError(null)
                    setName(defaultName)
                  }}
                >
                  <Pencil className="size-4" />
                  {t('Edit', 'تعديل')}
                </Button>
              ) : null}
            </div>

            {editing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="profile-name"
                    className="text-sm font-medium"
                    style={{ color: 'var(--m3-on-surface-variant)' }}
                  >
                    {t('Display name', 'الاسم')}
                  </label>
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('Your full name', 'اسمك الكامل')}
                    maxLength={120}
                    autoComplete="name"
                    className="h-12 rounded-xl border-2 text-base"
                    style={{ borderColor: 'var(--m3-outline)' }}
                  />
                </div>
                {formError ? (
                  <p className="text-sm font-medium text-red-700">{formError}</p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex h-10 min-h-10 items-center justify-center rounded-full px-6 text-sm font-semibold transition-opacity disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--m3-primary)',
                      color: 'var(--m3-on-primary)',
                    }}
                  >
                    {saving ? t('Saving…', 'جاري الحفظ…') : t('Save', 'حفظ')}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-semibold text-[color:var(--m3-primary)] hover:bg-black/[0.05]"
                    onClick={() => {
                      setEditing(false)
                      setName(defaultName)
                      setFormError(null)
                    }}
                    disabled={saving}
                  >
                    {t('Cancel', 'إلغاء')}
                  </button>
                </div>
              </div>
            ) : (
              <p
                className="text-xl font-semibold tracking-tight"
                style={{ color: 'var(--m3-on-surface)' }}
              >
                {defaultName || t('No name set', 'لم يُضف اسم')}
              </p>
            )}

            {saveOk ? (
              <p className="mt-3 text-sm font-semibold text-emerald-800" role="status">
                {t('Profile saved.', 'تم حفظ الملف الشخصي.')}
              </p>
            ) : null}

            <div
              className="mt-6 space-y-4 border-t pt-5"
              style={{ borderColor: 'var(--m3-outline-variant)' }}
            >
              <div className="flex gap-4 text-sm">
                <Mail
                  className="mt-0.5 size-5 shrink-0"
                  style={{ color: 'var(--m3-on-surface-variant)' }}
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    {t('Email', 'البريد')}
                  </p>
                  <p className="break-all font-medium" style={{ color: 'var(--m3-on-surface)' }}>
                    {emailDisplay}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    {t('Managed by your login account.', 'يُدار من حساب تسجيل الدخول.')}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <Phone
                  className="mt-0.5 size-5 shrink-0"
                  style={{ color: 'var(--m3-on-surface-variant)' }}
                />
                <div>
                  <p className="font-medium" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    {t('Phone', 'الهاتف')}
                  </p>
                  <p className="font-medium" style={{ color: 'var(--m3-on-surface)' }}>
                    {phoneDisplay}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/verify-phone?returnTo=${encodeURIComponent('/profile')}&intent=change`}
                      className="text-xs font-bold underline-offset-4 hover:underline"
                      style={{ color: 'var(--m3-primary)' }}
                    >
                      {t('Verify or change phone', 'التحقق أو تغيير الهاتف')}
                    </Link>
                    {clerk.phoneVerified ? (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                        style={{
                          backgroundColor: 'var(--m3-tertiary-container)',
                          color: 'var(--m3-on-tertiary-container)',
                        }}
                      >
                        {t('Verified', 'موثّق')}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {customer?.orderCount != null ? (
              <p className="mt-4 text-xs font-medium" style={{ color: 'var(--m3-on-surface-variant)' }}>
                {t('Total orders:', 'إجمالي الطلبات:')}{' '}
                <span style={{ color: 'var(--m3-on-surface)' }}>{customer.orderCount}</span>
              </p>
            ) : null}
          </CustomerM3Card>
        </CustomerM3MotionSection>

        <CustomerM3MotionSection delay={0.05}>
          <CustomerM3Card>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <CustomerM3SectionTitle
                title={t('Recent orders', 'أحدث الطلبات')}
                subtitle={t(
                  'Track and reorder from your history.',
                  'تتبع طلباتك وسجلّها.'
                )}
              />
              <CustomerM3OutlinedLink href="/my-orders" className="shrink-0">
                {t('View all', 'عرض الكل')}
                <ChevronRight className="size-4 rtl:rotate-180" />
              </CustomerM3OutlinedLink>
            </div>

            {previewOrders.length === 0 ? (
              <div
                className="rounded-2xl border-2 border-dashed p-8 text-center md:p-10"
                style={{
                  backgroundColor: 'var(--m3-surface-container)',
                  borderColor: 'var(--m3-outline-variant)',
                }}
              >
                <Package
                  className="mx-auto mb-4 size-14 opacity-40"
                  style={{ color: 'var(--m3-on-surface-variant)' }}
                />
                <p className="text-base font-semibold" style={{ color: 'var(--m3-on-surface)' }}>
                  {t('No orders yet', 'لا طلبات بعد')}
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  {t(
                    'When you place an order, it will appear here.',
                    'عند تقديم طلب سيظهر هنا.'
                  )}
                </p>
                <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <CustomerM3FilledLink href={BROWSE_HREF}>
                    {t('Browse restaurants', 'تصفح المطاعم')}
                  </CustomerM3FilledLink>
                  <CustomerM3TonalLink href="/search?category=stores">
                    {t('Browse stores', 'تصفح المتاجر')}
                  </CustomerM3TonalLink>
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {previewOrders.map((order) => {
                  const trackHref =
                    order.siteSlug && order.trackingToken
                      ? `/t/${order.siteSlug}/track/${order.trackingToken}`
                      : null
                  const businessName =
                    order.siteName?.trim() || order.siteSlug || t('Order', 'طلب')
                  const active = order.status && ACTIVE_STATUSES.has(order.status)
                  return (
                    <li
                      key={order._id}
                      className="rounded-2xl border p-4 md:p-5"
                      style={
                        active
                          ? {
                              backgroundColor: 'var(--m3-tertiary-container)',
                              borderColor: 'var(--m3-outline-variant)',
                            }
                          : {
                              backgroundColor: 'var(--m3-surface-container)',
                              borderColor: 'var(--m3-outline-variant)',
                            }
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div
                            className="mb-1 flex items-center gap-2 text-xs font-medium"
                            style={{ color: 'var(--m3-on-surface-variant)' }}
                          >
                            <Store className="size-3.5 shrink-0" />
                            <span className="truncate">{businessName}</span>
                          </div>
                          <p className="font-bold" style={{ color: 'var(--m3-on-surface)' }}>
                            #{order.orderNumber || order._id.slice(-6)}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--m3-on-surface-variant)' }}>
                            {statusLabel(order.status)} · {formatDate(order.createdAt)}
                          </p>
                          <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--m3-on-surface)' }}>
                            {formatAmount(order.totalAmount, order.currency)}
                          </p>
                        </div>
                        {trackHref ? (
                          <CustomerM3OutlinedLink href={trackHref} className="h-9 shrink-0 px-3 text-xs">
                            {t('Track', 'تتبع')}
                          </CustomerM3OutlinedLink>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CustomerM3Card>
        </CustomerM3MotionSection>

        <div className="flex justify-center pb-4">
          <Link
            href="/my-orders"
            className="text-sm font-semibold underline-offset-4 hover:underline"
            style={{ color: 'var(--m3-primary)' }}
          >
            {t('View full order history', 'عرض سجل الطلبات كاملاً')}
          </Link>
        </div>

        <CustomerM3MotionSection delay={0.08}>
          <CustomerM3Card>
            <CustomerM3SectionTitle
              title={t('Account & security', 'الحساب والأمان')}
              subtitle={t(
                'Manage email, password, sessions, and sign-in methods.',
                'إدارة البريد وكلمة المرور والجلسات وطرق تسجيل الدخول.'
              )}
            />
            <div className="mt-4 w-full overflow-x-auto">
              <UserProfile
                routing="hash"
                appearance={{
                  variables: {
                    borderRadius: '1rem',
                    colorPrimary: 'oklch(0.58 0.16 75)',
                  },
                  elements: {
                    rootBox: 'w-full flex justify-stretch',
                    card: 'w-full !shadow-none border-0 bg-transparent',
                    navbar: 'rounded-xl',
                    navbarMobileMenuRow: 'rounded-xl',
                  },
                }}
              />
            </div>
          </CustomerM3Card>
        </CustomerM3MotionSection>
      </CustomerM3Content>
    </CustomerM3PageScaffold>
  )
}
