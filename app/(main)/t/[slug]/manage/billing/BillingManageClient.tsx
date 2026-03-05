'use client'

import { useState, useEffect, useRef } from 'react'
import Script from 'next/script'
import { motion } from 'motion/react'
import { useLanguage } from '@/components/LanguageContext'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SUBSCRIPTION_PLANS, getPayPalLinkForPlan, type PlanId } from '@/lib/subscription'
import { BankOfPalestineCard } from './BankOfPalestineCard'
import { ExternalLink, CreditCard, Building2, Wallet, Phone } from 'lucide-react'

const PLAN_ORDER: PlanId[] = ['1m', '3m', '6m', '12m']

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? ''

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: {
        style?: { shape?: string; color?: string; layout?: string; label?: string }
        createSubscription?: (data: unknown, actions: { subscription: { create: (opts: { plan_id: string }) => Promise<unknown> } }) => Promise<unknown>
        createOrder?: () => Promise<string>
        onApprove?: (data: { orderID?: string; subscriptionID?: string }, actions: unknown) => void | Promise<void>
        onError?: (err: unknown) => void
        onCancel?: () => void
      }) => { render: (selector: string) => Promise<void> }
    }
  }
}

function formatExpiry(iso: string | null, t: (en: string, ar: string) => string): string {
  if (!iso) return t('Not set', 'غير محدد')
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function BillingManageClient({
  slug,
  subscriptionExpiresAt,
  subscriptionLastPaymentAt = null,
  subscriptionStatus = 'trial',
  paypalSubscriptionId = null,
  useOrdersApi = false,
  subscriptionPlanId = '',
}: {
  slug: string
  subscriptionExpiresAt: string | null
  subscriptionLastPaymentAt?: string | null
  subscriptionStatus?: string
  paypalSubscriptionId?: string | null
  useOrdersApi?: boolean
  subscriptionPlanId?: string
}) {
  const { t, lang } = useLanguage()
  const isRtl = lang === 'ar'
  const [paypalSubSuccess, setPaypalSubSuccess] = useState<string | null>(null)
  const [paypalSubNewExpiresAt, setPaypalSubNewExpiresAt] = useState<string | null>(null)
  const [paypalSubError, setPaypalSubError] = useState<string | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [oneTimeSuccess, setOneTimeSuccess] = useState<string | null>(null)
  const [oneTimeError, setOneTimeError] = useState<string | null>(null)
  const [setupResult, setSetupResult] = useState<{ productId: string; planId: string } | null>(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [paypalSdkReady, setPaypalSdkReady] = useState(false)
  const [oneTimeCardChoice, setOneTimeCardChoice] = useState<'palestinian' | 'israeli' | null>(null)
  const paypalButtonRendered = useRef(false)
  const [paypalRefreshTrigger, setPaypalRefreshTrigger] = useState(0)
  const [oneTimeRedirectingPlanId, setOneTimeRedirectingPlanId] = useState<PlanId | null>(null)
  const [oneTimeRedirectError, setOneTimeRedirectError] = useState<string | null>(null)
  const planIdForSdk = subscriptionPlanId || 'P-7LW984279R694694UNGM7DII'

  const displayExpiresAt = paypalSubNewExpiresAt ?? subscriptionExpiresAt
  const expiresAt = displayExpiresAt ? new Date(displayExpiresAt) : null
  const isExpired = expiresAt ? expiresAt <= new Date() : false
  const daysRemaining =
    expiresAt && !isExpired
      ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null

  const handlePayPal = (planId: PlanId) => {
    if (!useOrdersApi) {
      const url = getPayPalLinkForPlan(planId)
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  /** One-time PayPal via redirect (avoids loading a second SDK and paypal_js_sdk_v5_unhandled_exception). */
  const handleOneTimePayPalRedirect = async (planId: PlanId) => {
    if (!useOrdersApi || !slug) return
    setOneTimeRedirectError(null)
    setOneTimeRedirectingPlanId(planId)
    try {
      const res = await fetch(`/api/tenants/${slug}/subscription/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setOneTimeRedirectError(json?.error ?? t('Could not start payment.', 'تعذر بدء الدفع.'))
        return
      }
      const approveUrl = json?.approveUrl
      if (typeof approveUrl === 'string' && approveUrl.startsWith('http')) {
        window.location.href = approveUrl
        return
      }
      setOneTimeRedirectError(t('Invalid response. Try again.', 'استجابة غير صالحة. حاول مرة أخرى.'))
    } catch {
      setOneTimeRedirectError(t('Network error. Try again.', 'خطأ في الشبكة. حاول مرة أخرى.'))
    } finally {
      setOneTimeRedirectingPlanId(null)
    }
  }

  useEffect(() => {
    if (!useOrdersApi || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('paypal_return') !== '1') return
    const orderId = params.get('token')?.trim()
    if (!orderId) return
    setOneTimeError(null)
    setOneTimeSuccess(t('Completing payment…', 'جاري إتمام الدفع…'))
    fetch(`/api/tenants/${slug}/subscription/capture-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    })
      .then((res) => res.json().catch(() => ({})))
      .then((json) => {
        if (json.ok) {
          setOneTimeSuccess(
            t('Payment completed. Refreshing…', 'تم الدفع. جاري التحديث…')
          )
          window.history.replaceState({}, '', window.location.pathname)
          setTimeout(() => window.document.location.reload(), 1500)
        } else {
          setOneTimeSuccess(null)
          setOneTimeError(json?.error ?? t('Payment could not be completed.', 'تعذر إتمام الدفع.'))
        }
      })
      .catch(() => {
        setOneTimeSuccess(null)
        setOneTimeError(t('Network error. Try again.', 'خطأ في الشبكة. حاول مرة أخرى.'))
      })
  }, [slug, useOrdersApi, t])

  useEffect(() => {
    if (!PAYPAL_CLIENT_ID || !paypalSdkReady || typeof window === 'undefined' || !window.paypal) return
    const container = document.getElementById('paypal-subscription-button-container')
    if (!container || container.hasChildNodes()) return
    paypalButtonRendered.current = true
    try {
      window.paypal
        .Buttons({
          style: {
            shape: 'rect',
            color: 'white',
            layout: 'vertical',
            label: 'subscribe',
          },
          createSubscription: (_, actions) =>
            actions.subscription.create({ plan_id: planIdForSdk }),
          onError: (err: unknown) => {
            console.error('[PayPal subscription]', err)
            const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : String(err)
            setPaypalSubError(message || t('PayPal subscription failed. See console.', 'فشل اشتراك PayPal. راجع وحدة التحكم.'))
          },
          onCancel: () => {
            setPaypalSubError(null)
          },
          onApprove: async (data) => {
            setPaypalSubError(null)
            setPaypalSubNewExpiresAt(null)
            try {
              const res = await fetch(`/api/tenants/${slug}/subscription/paypal-approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionID: data.subscriptionID }),
              })
              const json = await res.json().catch(() => ({}))
              if (!res.ok) {
                setPaypalSubError(json?.error ?? t('Failed to activate subscription.', 'فشل في تفعيل الاشتراك.'))
                return
              }
              const newExpiresAt = typeof json.subscriptionExpiresAt === 'string' ? json.subscriptionExpiresAt : null
              if (newExpiresAt) setPaypalSubNewExpiresAt(newExpiresAt)
              setPaypalSubSuccess(
                t('Subscription activated! Refreshing…', 'تم تفعيل الاشتراك! جاري التحديث…')
              )
              setTimeout(() => window.document.location.reload(), 2000)
            } catch {
              setPaypalSubError(t('Network error. Try again.', 'خطأ في الشبكة. حاول مرة أخرى.'))
            }
          },
        })
        .render('#paypal-subscription-button-container')
    } catch (err) {
      paypalButtonRendered.current = false
      console.error('[PayPal subscription render]', err)
      setPaypalSubError(t('PayPal could not load. Try refreshing the page.', 'تعذر تحميل PayPal. حدّث الصفحة.'))
    }
  }, [slug, t, paypalSdkReady, planIdForSdk, paypalRefreshTrigger])

  // Re-render subscription button if it disappears (e.g. SDK timeout or tab background)
  useEffect(() => {
    if (!PAYPAL_CLIENT_ID || !paypalSdkReady) return
    const id = setInterval(() => {
      if (typeof window === 'undefined' || !window.paypal) return
      const subContainer = document.getElementById('paypal-subscription-button-container')
      if (subContainer && !subContainer.hasChildNodes() && paypalButtonRendered.current) {
        paypalButtonRendered.current = false
        setPaypalRefreshTrigger((n) => n + 1)
      }
    }, 4000)
    return () => clearInterval(id)
  }, [paypalSdkReady])

  const runSetupPlan = async () => {
    setSetupError(null)
    setSetupResult(null)
    setSetupLoading(true)
    try {
      const res = await fetch(`/api/tenants/${slug}/subscription/setup-plan`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSetupError(json?.error ?? t('Setup failed.', 'فشل الإعداد.'))
        return
      }
      setSetupResult({ productId: json.productId, planId: json.planId })
    } catch {
      setSetupError(t('Network error. Try again.', 'خطأ في الشبكة. حاول مرة أخرى.'))
    } finally {
      setSetupLoading(false)
    }
  }

  const needSetupPlan = useOrdersApi && !subscriptionPlanId

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
          {t('Billing & subscription', 'الدفع والاشتراك')}
        </h1>
        <p className="mt-2 text-slate-400">
          {t(
            'Your site gets a 30-day free trial from the day it was created. When the trial, your subscription, or your one-time period ends, your site is hidden from customers. Choose a subscription or one-time plan below so your site remains visible.',
            'يحصل موقعك على تجربة مجانية 30 يوماً من يوم إنشائه. عند انتهاء التجربة أو الاشتراك أو الفترة لمرة واحدة، يُخفى موقعك عن العملاء. اختر اشتراكاً أو خطة لمرة واحدة أدناه ليبقى موقعك ظاهراً.'
          )}
        </p>
      </div>

      {/* One-time setup: create product + plan when plan ID not in env */}
      {needSetupPlan && (
        <section>
          <Card className="border-slate-700 bg-slate-900/80">
            <CardHeader>
              <CardTitle className="text-lg text-white">
                {t('Create subscription plan', 'إنشاء خطة اشتراك')}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {t(
                  'Create the PayPal product and monthly plan from this app (one-time). Then add the Plan ID to your environment and restart.',
                  'أنشئ منتج PayPal وخطة الاشتراك الشهرية من التطبيق (مرة واحدة). ثم أضف معرف الخطة إلى البيئة وأعد التشغيل.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {setupResult ? (
                <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                  <p className="font-medium">{t('Product ID', 'معرف المنتج')}: {setupResult.productId}</p>
                  <p className="font-medium mt-2">{t('Plan ID', 'معرف الخطة')}: {setupResult.planId}</p>
                  <p className="mt-3 text-slate-300">
                    {t('Add to .env and restart', 'أضف إلى .env وأعد التشغيل')}:
                  </p>
                  <code className="mt-1 block break-all rounded bg-slate-800 px-2 py-2 text-amber-300">
                    NEXT_PUBLIC_PAYPAL_SUBSCRIPTION_PLAN_ID={setupResult.planId}
                  </code>
                </div>
              ) : (
                <Button
                  onClick={runSetupPlan}
                  disabled={setupLoading}
                  variant="outline"
                  className="border-slate-600 text-slate-200 hover:bg-slate-800"
                >
                  {setupLoading
                    ? t('Creating…', 'جاري الإنشاء…')
                    : t('Create product & plan', 'إنشاء المنتج والخطة')}
                </Button>
              )}
              {setupError && (
                <p className="text-sm text-rose-400">{setupError}</p>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* PayPal recurring subscription (when plan ID is set) */}
      <section>
        <Card className="overflow-hidden border-amber-500/50 bg-slate-900/90 ring-2 ring-amber-500/40 transition-all hover:ring-amber-500/60">
          <CardHeader className="pb-2">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
              {/* Left: 50% – title and description */}
              <div className="min-w-0 md:pr-4">
                <CardTitle className="text-xl text-white">
                  {t('Subscribe with PayPal', 'اشترك عبر PayPal')}
                </CardTitle>
                <CardDescription className="mt-1 text-slate-400">
                  {t('Subscribe and renew automatically each month. Cancel anytime in your PayPal account. Your business stays visible as long as your subscription is active.', 'اشترك ويتجدد تلقائياً كل شهر. يمكنك الإلغاء في أي وقت من حساب PayPal. متجرك يبقى ظاهراً طالما اشتراكك نشط.')}
                </CardDescription>
              </div>
              {/* Right (or left in RTL): Recommended badge above price box – match card style in Arabic */}
              <div className={`flex min-w-0 flex-col gap-3 ${isRtl ? 'items-start' : 'items-end'}`}>
                <Badge className="w-fit bg-amber-500 text-slate-950" dir={isRtl ? 'rtl' : 'ltr'}>
                  {t('Recommended', 'موصى به')}
                </Badge>
                <div
                  className={`w-full shrink-0 rounded-2xl border border-amber-500/40 bg-amber-500/15 px-5 py-4 md:max-w-[220px] ${isRtl ? 'text-start' : 'text-end'}`}
                  dir="ltr"
                >
                  <div className={`flex items-baseline gap-1.5 ${isRtl ? 'justify-start' : 'justify-end'}`}>
                    <span className="text-4xl font-bold tracking-tight text-amber-400 md:text-5xl">350</span>
                    <span className="text-xl font-medium text-amber-300/90 md:text-2xl">ILS</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-400 md:text-base">
                    {t('per month', 'شهرياً')}
                  </p>
                  {(displayExpiresAt || subscriptionLastPaymentAt) && (
                    <div className="mt-3 space-y-1 border-t border-amber-500/30 pt-3 text-xs text-slate-400">
                      {subscriptionLastPaymentAt && (
                        <p>
                          {t('Last payment', 'آخر دفعة')}:{' '}
                          <span className="text-amber-200/90">
                            {formatExpiry(subscriptionLastPaymentAt, t)}
                          </span>
                        </p>
                      )}
                      {daysRemaining !== null && !isExpired && (
                        <p>
                          {t('Days until next billing', 'أيام حتى الفاتورة القادمة')}:{' '}
                          <span className="font-semibold text-amber-200">
                            {daysRemaining} {t('days', 'يوماً')}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {PAYPAL_CLIENT_ID ? (
              <>
                <Script
                  src={`https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription`}
                  data-sdk-integration-source="button-factory"
                  strategy="afterInteractive"
                  onLoad={() => setPaypalSdkReady(true)}
                  onError={() => {
                    setPaypalSdkReady(false)
                    setPaypalSubError(t('PayPal script failed to load. Check your connection.', 'فشل تحميل PayPal. تحقق من اتصالك.'))
                  }}
                />
                <p className="mb-2 text-xs text-slate-400">
                  {t('Monthly subscription is available with Israeli card (PayPal) only.', 'الاشتراك الشهري متاح ببطاقة إسرائيلية (PayPal) فقط.')}
                </p>
                <div className="inline-block w-full max-w-[320px] rounded-xl border border-slate-600/60 bg-slate-800/50 p-3">
                  <div id="paypal-subscription-button-container" className="min-h-[45px] [&>div]:!max-w-full" />
                </div>
                {!paypalSdkReady && (
                  <p className="mt-2 text-sm text-slate-500">
                    {t('Loading PayPal…', 'جاري تحميل PayPal…')}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">
                {t(
                  'To enable this option, add NEXT_PUBLIC_PAYPAL_CLIENT_ID (and optionally NEXT_PUBLIC_PAYPAL_SUBSCRIPTION_PLAN_ID) to your environment and restart the server.',
                  'لتفعيل هذا الخيار، أضف NEXT_PUBLIC_PAYPAL_CLIENT_ID (واختيارياً NEXT_PUBLIC_PAYPAL_SUBSCRIPTION_PLAN_ID) إلى البيئة وأعد تشغيل الخادم.'
                )}
              </p>
            )}
            {(paypalSubSuccess || paypalSubError) && (
              <div
                className={`mt-3 rounded-xl border px-4 py-3 ${
                  paypalSubError
                    ? 'border-rose-500/50 bg-rose-500/10 text-rose-300'
                    : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                }`}
              >
                {paypalSubError ? (
                  paypalSubError
                ) : (
                  <div className="space-y-2">
                    <p className="font-medium">{paypalSubSuccess}</p>
                    {paypalSubNewExpiresAt && (
                      <p className="text-emerald-100 text-sm">
                        {t('Your subscription is active until', 'اشتراكك نشط حتى')}{' '}
                        <strong className="text-white">
                          {formatExpiry(paypalSubNewExpiresAt, t)}
                        </strong>
                        {' '}(+30 {t('days', 'يوماً')})
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Only show Cancel when user has an active PayPal recurring subscription (subscribed successfully). */}
            {paypalSubscriptionId && subscriptionStatus === 'active' && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-600/60 bg-slate-800/40 px-4 py-3">
                <p className="text-sm text-slate-400">
                  {t('Cancel anytime. You keep access until your current period ends.', 'ألغِ في أي وقت. ستبقى لديك الوصول حتى نهاية الفترة الحالية.')}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cancelLoading}
                  onClick={async () => {
                    if (!confirm(t('Cancel your monthly subscription? You can still use the platform until the expiry date.', 'إلغاء اشتراكك الشهري؟ يمكنك الاستمرار في استخدام المنصة حتى تاريخ الانتهاء.'))) return
                    setCancelError(null)
                    setCancelSuccess(null)
                    setCancelLoading(true)
                    try {
                      const res = await fetch(`/api/tenants/${slug}/subscription/cancel`, { method: 'POST' })
                      const json = await res.json().catch(() => ({}))
                      if (!res.ok) {
                        setCancelError(json?.error ?? t('Failed to cancel.', 'فشل الإلغاء.'))
                        return
                      }
                      setCancelSuccess(t('Subscription cancelled. You keep access until the expiry date.', 'تم إلغاء الاشتراك. وصولك يبقى حتى تاريخ الانتهاء.'))
                      setTimeout(() => window.document.location.reload(), 2000)
                    } catch {
                      setCancelError(t('Network error. Try again.', 'خطأ في الشبكة. حاول مرة أخرى.'))
                    } finally {
                      setCancelLoading(false)
                    }
                  }}
                  className="border-slate-500 text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  {cancelLoading ? t('Cancelling…', 'جاري الإلغاء…') : t('Cancel subscription', 'إلغاء الاشتراك')}
                </Button>
              </div>
            )}
            {(cancelSuccess || cancelError) && (
              <p className={`mt-2 text-sm ${cancelError ? 'text-rose-400' : 'text-emerald-400'}`}>
                {cancelSuccess ?? cancelError}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Subscription status: expiry date and days remaining */}
      <Card className="border-slate-800 bg-slate-900/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-white">
            {t('Subscription status', 'حالة الاشتراك')}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {t('Your business is visible on the platform until the date below. After you pay, this page will show the new expiry when you refresh or return here.', 'متجرك ظاهر على المنصة حتى التاريخ أدناه. بعد الدفع، ستظهر هنا تاريخ الانتهاء الجديد عند التحديث أو العودة.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(displayExpiresAt || paypalSubNewExpiresAt) ? (
            <>
              {paypalSubNewExpiresAt && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
                  {t('Subscription updated: your business is visible until the date below.', 'تم تحديث الاشتراك: متجرك ظاهر حتى التاريخ أدناه.')}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-300">
                  {t('Expires on', 'ينتهي في')}:
                </span>
                <span className="font-semibold text-white">
                  {formatExpiry(displayExpiresAt!, t)}
                </span>
                <Badge variant={isExpired ? 'destructive' : 'secondary'} className="text-xs">
                  {isExpired
                    ? t('Expired', 'منتهي')
                    : daysRemaining !== null && daysRemaining <= 7
                      ? t('Less than 1 week left', 'أقل من أسبوع متبقي')
                      : daysRemaining !== null
                        ? t('Days remaining', 'أيام متبقية') + `: ${daysRemaining}`
                        : ''}
                </Badge>
              </div>
              {isExpired && (
                <p className="text-sm text-rose-400">
                  {t('Your business is currently hidden. Subscribe above to reactivate.', 'متجرك مخفي حالياً. اشترك أعلاه لإعادة التفعيل.')}
                </p>
              )}
            </>
          ) : (
            <p className="text-slate-400">
              {t('No expiry date set. Your business remains visible. Subscribe above to add a subscription period.', 'لم يُحدد تاريخ انتهاء. متجرك يبقى ظاهراً. اشترك أعلاه لإضافة فترة اشتراك.')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* One-time packages: choose Palestinian (Bank of Palestine) or Israeli (PayPal) first. No second PayPal script — one-time uses redirect to avoid paypal_js_sdk_v5_unhandled_exception. */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">
          {t('One-time plans', 'باقات لمرة واحدة')}
        </h2>
        {useOrdersApi && (
          <p className="mb-4 text-sm text-slate-400">
            {t('Palestine is not in PayPal’s supported countries. Choose how you want to pay:', 'فلسطين ليست من الدول المدعومة في PayPal. اختر طريقة الدفع:')}
          </p>
        )}

        {useOrdersApi && oneTimeCardChoice === null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 grid gap-4 sm:grid-cols-2"
          >
            <Button
              variant="outline"
              size="lg"
              className="h-auto flex-col gap-2 border-slate-600 bg-slate-800/60 py-6 text-slate-200 hover:border-[#aa2267] hover:bg-[#aa2267]/20 hover:text-white"
              onClick={() => setOneTimeCardChoice('palestinian')}
            >
              <Building2 className="size-8 shrink-0" style={{ color: '#aa2267' }} />
              <span className="font-semibold">{t('Palestinian card', 'بطاقة فلسطينية')}</span>
              <span className="text-xs font-normal text-slate-400">
                {t('Bank of Palestine — scan QR to pay', 'بنك فلسطين — امسح رمز QR للدفع')}
              </span>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-auto flex-col gap-2 border-slate-600 bg-slate-800/60 py-6 text-slate-200 hover:border-amber-500 hover:bg-amber-500/20 hover:text-white"
              onClick={() => setOneTimeCardChoice('israeli')}
            >
              <Wallet className="size-8 shrink-0 text-amber-400" />
              <span className="font-semibold">{t('Israeli card', 'بطاقة إسرائيلية')}</span>
              <span className="text-xs font-normal text-slate-400">
                {t('Pay with PayPal in a popup', 'ادفع عبر PayPal في نافذة منبثقة')}
              </span>
            </Button>
          </motion.div>
        )}

        {useOrdersApi && oneTimeCardChoice === 'palestinian' && (
          <div className="mb-6">
            <Button
              variant="ghost"
              size="sm"
              className="mb-3 text-slate-400 hover:text-white"
              onClick={() => setOneTimeCardChoice(null)}
            >
              ← {t('Change payment method', 'تغيير طريقة الدفع')}
            </Button>
            <BankOfPalestineCard t={t} isRtl={isRtl} />
          </div>
        )}

        {(oneTimeCardChoice === 'israeli' || !useOrdersApi) && (
          <>
            {useOrdersApi && oneTimeCardChoice === 'israeli' && (
              <Button
                variant="ghost"
                size="sm"
                className="mb-3 text-slate-400 hover:text-white"
                onClick={() => setOneTimeCardChoice(null)}
              >
                ← {t('Change payment method', 'تغيير طريقة الدفع')}
              </Button>
            )}
            {useOrdersApi && oneTimeCardChoice === 'israeli' && (
              <p className="mb-4 text-sm text-slate-400">
                {t('Pay with PayPal in a popup — you stay on this page. Payment window has a light background for better visibility.', 'ادفع عبر PayPal في نافذة منبثقة — تبقى على هذه الصفحة. نافذة الدفع بخلفية فاتحة لوضوح أفضل.')}
              </p>
            )}
            {(oneTimeSuccess || oneTimeError || oneTimeRedirectError) && (
              <div
                className={`mb-4 rounded-xl border px-4 py-3 ${
                  oneTimeError || oneTimeRedirectError
                    ? 'border-rose-500/50 bg-rose-500/10 text-rose-300'
                    : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                }`}
              >
                {oneTimeSuccess ?? oneTimeError ?? oneTimeRedirectError}
              </div>
            )}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PLAN_ORDER.map((planId) => {
                const plan = SUBSCRIPTION_PLANS[planId]
                const popular = planId === '12m'
                return (
                  <Card
                    key={planId}
                    className={`relative overflow-hidden border-slate-800 bg-slate-900/80 transition-all hover:border-slate-600 hover:bg-slate-900 ${
                      popular ? 'ring-2 ring-amber-500/50' : ''
                    }`}
                  >
                    {popular && (
                      <div className="absolute end-3 top-3">
                        <Badge className="bg-amber-500/90 text-slate-950" dir={isRtl ? 'rtl' : 'ltr'}>
                          {t('Best value', 'الأفضل')}
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-white">
                        {t(plan.labelEn, plan.labelAr)}
                      </CardTitle>
                      <CardDescription className="text-slate-400">
                        {plan.months === 1
                          ? t('Full access for one month', 'وصول كامل لشهر واحد')
                          : t('Save more with longer plans', 'وفر أكثر مع الباقات الأطول')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-white">{plan.priceIls}</span>
                        <span className="text-slate-400">ILS</span>
                      </div>
                      {plan.months > 1 && (
                        <p className="text-xs text-slate-500">
                          {plan.perMonthIls} ILS {t('/ month', '/ شهر')}
                        </p>
                      )}
                    </CardContent>
                    <CardFooter className="border-t border-slate-800 pt-4">
                      <Button
                        onClick={() => (useOrdersApi && PAYPAL_CLIENT_ID ? handleOneTimePayPalRedirect(planId) : handlePayPal(planId))}
                        disabled={useOrdersApi && oneTimeRedirectingPlanId === planId}
                        className="w-full bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400"
                        size="lg"
                      >
                        <CreditCard className="me-2 size-4 shrink-0" />
                        <span className="flex-1">
                          {useOrdersApi && oneTimeRedirectingPlanId === planId
                            ? t('Redirecting…', 'جاري التوجيه…')
                            : t('Pay with PayPal', 'الدفع عبر PayPal') + ` — ${plan.priceIls} ILS`}
                        </span>
                        <ExternalLink className="ms-2 size-3.5 shrink-0" />
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* Manual Payment Section */}
      <section className="mt-8">
        <Card className="overflow-hidden border-indigo-500/50 bg-slate-900/90 ring-1 ring-indigo-500/40 transition-all hover:ring-indigo-500/60">
          <CardContent className="flex flex-col items-center text-center p-8 space-y-4">
            <div className="rounded-full bg-indigo-500/20 p-4">
              <Phone className="h-8 w-8 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">
                {t('Pay in Cash or Bank Transfer', 'الدفع نقداً أو حوالة بنكية')}
              </h2>
              <p className="text-slate-400 max-w-md mx-auto">
                {t(
                  'Prefer to pay directly? You can contact us to arrange a cash payment or bank transfer. We will activate your subscription manually.',
                  'تفضل الدفع المباشر؟ يمكنك التواصل معنا لترتيب الدفع نقداً أو عبر حوالة بنكية. سنقوم بتفعيل اشتراكك يدوياً.'
                )}
              </p>
            </div>
            <a
              href="tel:0569611116"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:bg-indigo-500 hover:scale-105 active:scale-95"
            >
              <Phone className="h-5 w-5" />
              <span dir="ltr">0569611116</span>
            </a>
          </CardContent>
        </Card>
      </section>

      <p className="text-sm text-slate-500">
        {t(
          'After you pay via PayPal, your subscription is extended automatically. Refresh this page or return later to see the updated expiry date.',
          'بعد الدفع عبر PayPal، يتم تمديد اشتراكك تلقائياً. حدّث هذه الصفحة أو عد لاحقاً لرؤية تاريخ الانتهاء المحدّث.'
        )}
      </p>
    </div>
  )
}
