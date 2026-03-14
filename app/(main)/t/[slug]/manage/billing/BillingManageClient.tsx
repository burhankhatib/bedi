'use client'

import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { useLanguage } from '@/components/LanguageContext'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  SUBSCRIPTION_PLANS,
  type PlanId,
  type PlanTier,
} from '@/lib/subscription'
import { BankOfPalestineCard } from './BankOfPalestineCard'
import { ExternalLink, CreditCard, Check, Phone } from 'lucide-react'

type BillingPeriod = 'monthly' | 'yearly'

const PLAN_TIERS: { tier: PlanTier; labelEn: string; labelAr: string; features: { en: string; ar: string }[] }[] = [
  {
    tier: 'basic',
    labelEn: 'Basic',
    labelAr: 'باسيك',
    features: [
      { en: '30 products max', ar: '٣٠ منتجاً كحد أقصى' },
      { en: 'Full menu management', ar: 'إدارة قائمة كاملة' },
      { en: 'Analytics & History', ar: 'التحليلات والسجل' },
    ],
  },
  {
    tier: 'pro',
    labelEn: 'Pro',
    labelAr: 'برو',
    features: [
      { en: '50 products max', ar: '٥٠ منتجاً كحد أقصى' },
      { en: 'Tables & Staff', ar: 'الطاولات والموظفون' },
      { en: 'Full menu management', ar: 'إدارة قائمة كاملة' },
      { en: 'Analytics & History', ar: 'التحليلات والسجل' },
    ],
  },
  {
    tier: 'ultra',
    labelEn: 'Ultra',
    labelAr: 'ألترا',
    features: [
      { en: 'Unlimited products', ar: 'منتجات غير محدودة' },
      { en: 'Tables & Staff', ar: 'الطاولات والموظفون' },
      { en: 'Full menu management', ar: 'إدارة قائمة كاملة' },
      { en: 'Analytics & History', ar: 'التحليلات والسجل' },
    ],
  },
]

function formatExpiry(iso: string | null, t: (en: string, ar: string) => string): string {
  if (!iso) return t('Not set', 'غير محدد')
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function getPlanIdForTier(tier: PlanTier, period: BillingPeriod): PlanId {
  return `${tier}-${period}` as PlanId
}

export function BillingManageClient({
  slug,
  subscriptionExpiresAt,
  subscriptionLastPaymentAt = null,
  subscriptionStatus = 'trial',
  subscriptionPlan = null,
  useBOP = false,
  hidePayPal = true,
}: {
  slug: string
  subscriptionExpiresAt: string | null
  subscriptionLastPaymentAt?: string | null
  subscriptionStatus?: string
  subscriptionPlan?: 'basic' | 'pro' | 'ultra' | null
  paypalSubscriptionId?: string | null
  useOrdersApi?: boolean
  subscriptionPlanId?: string
  useBOP?: boolean
  hidePayPal?: boolean
}) {
  const { t, lang } = useLanguage()
  const isRtl = lang === 'ar'
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly')
  const [bopRedirectingPlanId, setBopRedirectingPlanId] = useState<PlanId | null>(null)
  const [bopRedirectError, setBopRedirectError] = useState<string | null>(null)
  const [oneTimeSuccess, setOneTimeSuccess] = useState<string | null>(null)

  const displayExpiresAt = subscriptionExpiresAt
  const expiresAt = displayExpiresAt ? new Date(displayExpiresAt) : null
  const isExpired = expiresAt ? expiresAt <= new Date() : false
  const daysRemaining =
    expiresAt && !isExpired
      ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null

  const handleBOPPayment = async (planId: PlanId) => {
    if (!useBOP || !slug) return
    setBopRedirectError(null)
    setOneTimeSuccess(null)
    setBopRedirectingPlanId(planId)
    try {
      const res = await fetch(`/api/tenants/${slug}/subscription/create-bop-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setBopRedirectError(json?.error ?? t('Could not start payment.', 'تعذر بدء الدفع.'))
        return
      }
      const paymentUrl = json?.paymentUrl
      if (typeof paymentUrl === 'string' && paymentUrl.startsWith('http')) {
        window.location.href = paymentUrl
        return
      }
      if (json?.manual) {
        setOneTimeSuccess(t('Use the QR code below to pay. Select your plan amount.', 'استخدم رمز QR أدناه للدفع. اختر مبلغ خطتك.'))
        setTimeout(() => {
          document.getElementById('bop-qr-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      } else {
        setBopRedirectError(t('No payment URL returned. Try QR payment below.', 'لم يُرجع رابط دفع. جرّب الدفع عبر QR أدناه.'))
      }
    } catch {
      setBopRedirectError(t('Network error. Try again.', 'خطأ في الشبكة. حاول مرة أخرى.'))
    } finally {
      setBopRedirectingPlanId(null)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    if (params.get('bop_return') === '1') {
      setOneTimeSuccess(t('Payment completed. Refreshing…', 'تم الدفع. جاري التحديث…'))
      window.history.replaceState({}, '', window.location.pathname)
      setTimeout(() => window.document.location.reload(), 1500)
    }
  }, [slug, t])

  if (!useBOP) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
          {t('Billing & subscription', 'الدفع والاشتراك')}
        </h1>
        <Card className="border-amber-500/40 bg-slate-900/80">
          <CardContent className="pt-6">
            <p className="text-slate-400">
              {t(
                'Bank of Palestine payments are not configured. Add BOP_PAYMENTS_API_KEY and BOP_PAYMENTS_API_SECRET to your environment.',
                'لم يتم تكوين مدفوعات بنك فلسطين. أضف BOP_PAYMENTS_API_KEY و BOP_PAYMENTS_API_SECRET إلى البيئة.'
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
          {t('Billing & subscription', 'الدفع والاشتراك')}
        </h1>
        <p className="mt-2 text-slate-400">
          {t(
            '30-day Ultra trial from business creation. Then choose Basic, Pro, or Ultra. Pay with Bank of Palestine.',
            'تجربة Ultra مجانية ٣٠ يوماً من إنشاء المتجر. ثم اختر باسيك أو برو أو ألترا. الدفع عبر بنك فلسطين.'
          )}
        </p>
      </div>

      {/* Billing period toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-400">{t('Billing period', 'فترة الفوترة')}:</span>
        <div
          role="group"
          aria-label={t('Billing period', 'فترة الفوترة')}
          className="inline-flex rounded-full border border-slate-700 bg-slate-900/80 p-1"
        >
          <button
            type="button"
            onClick={() => setBillingPeriod('monthly')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              billingPeriod === 'monthly'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('Monthly', 'شهري')}
          </button>
          <button
            type="button"
            onClick={() => setBillingPeriod('yearly')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              billingPeriod === 'yearly'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('Yearly (11 months + 1 free)', 'سنوي (١١ شهراً + ١ مجاني)')}
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">
          {t('Choose your plan', 'اختر خطتك')}
        </h2>
        {(oneTimeSuccess || bopRedirectError) && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 ${
              bopRedirectError
                ? 'border-rose-500/50 bg-rose-500/10 text-rose-300'
                : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {oneTimeSuccess ?? bopRedirectError}
          </div>
        )}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLAN_TIERS.map(({ tier, labelEn, labelAr, features }) => {
            const planId = getPlanIdForTier(tier, billingPeriod)
            const plan = SUBSCRIPTION_PLANS[planId]
            if (!plan) return null
            const isCurrentPlan = subscriptionPlan === tier && (subscriptionStatus === 'active' || subscriptionStatus === 'trial')
            const isUltra = tier === 'ultra'

            return (
              <Card
                key={planId}
                className={`relative overflow-hidden border-slate-700 bg-slate-900/90 transition-all hover:border-slate-600 ${
                  isUltra ? 'ring-2 ring-amber-500/50' : ''
                }`}
              >
                {isUltra && (
                  <div className="absolute end-3 top-3">
                    <Badge className="bg-amber-500/90 text-slate-950" dir={isRtl ? 'rtl' : 'ltr'}>
                      {t('Best value', 'الأفضل')}
                    </Badge>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute start-3 top-3">
                    <Badge variant="secondary" className="border-emerald-500/50 text-emerald-300">
                      {t('Current', 'الحالية')}
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-white">{t(labelEn, labelAr)}</CardTitle>
                  <CardDescription className="text-slate-400">
                    {billingPeriod === 'yearly'
                      ? t('11 months paid, 1 month free', '١١ شهراً مدفوع + شهر مجاني')
                      : t('Billed monthly', 'فوترة شهرية')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">{plan.priceIls}</span>
                    <span className="text-slate-400">ILS</span>
                  </div>
                  {billingPeriod === 'yearly' && (
                    <p className="text-xs text-slate-500">
                      ~{plan.perMonthIls} ILS {t('/ month', '/ شهر')}
                    </p>
                  )}
                  <ul className="space-y-2">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                        <Check className="size-4 shrink-0 text-emerald-500" />
                        {t(f.en, f.ar)}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="border-t border-slate-800 pt-4">
                  <Button
                    onClick={() => handleBOPPayment(planId)}
                    disabled={bopRedirectingPlanId === planId || isCurrentPlan}
                    className="w-full font-semibold text-white hover:opacity-90"
                    style={isUltra ? { backgroundColor: '#eab308' } : undefined}
                    variant={isUltra ? 'default' : 'secondary'}
                    size="lg"
                  >
                    <CreditCard className="me-2 size-4 shrink-0" />
                    <span className="flex-1">
                      {isCurrentPlan
                        ? t('Current plan', 'الخطة الحالية')
                        : bopRedirectingPlanId === planId
                          ? t('Redirecting…', 'جاري التوجيه…')
                          : t('Pay with Bank of Palestine', 'الدفع عبر بنك فلسطين') + ` — ${plan.priceIls} ILS`}
                    </span>
                    {!isCurrentPlan && bopRedirectingPlanId !== planId && (
                      <ExternalLink className="ms-2 size-3.5 shrink-0" />
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
        <p className="mt-4 text-sm text-slate-400">
          {t('Or use the QR code below if the payment link is not available.', 'أو استخدم رمز QR أدناه إذا لم يكن رابط الدفع متاحاً.')}
        </p>
        <div id="bop-qr-section" className="mt-4">
          <BankOfPalestineCard t={t} isRtl={isRtl} />
        </div>
      </section>

      {/* Subscription status */}
      <Card className="border-slate-800 bg-slate-900/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-white">
            {t('Subscription status', 'حالة الاشتراك')}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {t(
              'Your business is visible until the date below. Subscribe above to extend.',
              'متجرك ظاهر حتى التاريخ أدناه. اشترك أعلاه للتمديد.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {displayExpiresAt ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-300">{t('Expires on', 'ينتهي في')}:</span>
                <span className="font-semibold text-white">{formatExpiry(displayExpiresAt, t)}</span>
                <Badge variant={isExpired ? 'destructive' : 'secondary'} className="text-xs">
                  {isExpired
                    ? t('Expired', 'منتهي')
                    : daysRemaining !== null && daysRemaining <= 7
                      ? t('Less than 1 week left', 'أقل من أسبوع متبقي')
                      : daysRemaining !== null
                        ? `${daysRemaining} ${t('days left', 'يوم متبقي')}`
                        : ''}
                </Badge>
              </div>
              {subscriptionPlan && (
                <p className="text-sm text-slate-400">
                  {t('Current plan', 'الخطة الحالية')}: {t(PLAN_TIERS.find((p) => p.tier === subscriptionPlan)?.labelEn ?? subscriptionPlan, PLAN_TIERS.find((p) => p.tier === subscriptionPlan)?.labelAr ?? subscriptionPlan)}
                </p>
              )}
              {isExpired && (
                <p className="text-sm text-rose-400">
                  {t('Your business is hidden. Subscribe above to reactivate.', 'متجرك مخفي. اشترك أعلاه لإعادة التفعيل.')}
                </p>
              )}
            </>
          ) : (
            <p className="text-slate-400">
              {t('No expiry set. Subscribe above to add a period.', 'لم يُحدد تاريخ انتهاء. اشترك أعلاه لإضافة فترة.')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Manual payment */}
      <Card className="border-indigo-500/40 bg-slate-900/90">
        <CardContent className="flex flex-col items-center py-8 text-center">
          <div className="rounded-full bg-indigo-500/20 p-4">
            <Phone className="size-8 text-indigo-400" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-white">
            {t('Pay in Cash or Bank Transfer', 'الدفع نقداً أو حوالة بنكية')}
          </h2>
          <p className="mt-2 max-w-md text-slate-400">
            {t(
              'Contact us to arrange cash or bank transfer. We will activate your subscription manually.',
              'تواصل معنا لترتيب الدفع نقداً أو حوالة بنكية. سنفّعّل اشتراكك يدوياً.'
            )}
          </p>
          <a
            href="tel:0569611116"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:bg-indigo-500"
          >
            <Phone className="size-5" />
            <span dir="ltr">0569611116</span>
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
