'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AppNav } from '@/components/saas/AppNav'
import { PublicFooter } from '@/components/saas/PublicFooter'
import { useLanguage } from '@/components/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { SUBSCRIPTION_PLANS, type PlanId } from '@/lib/subscription'
import {
  CreditCard,
  Check,
  Zap,
  Calendar,
  HelpCircle,
  Store,
  ChevronRight,
} from 'lucide-react'

const PLAN_ORDER: PlanId[] = ['1m', '3m', '6m', '12m']

export function PricingPageClient() {
  const { lang, t } = useLanguage()
  const isRtl = lang === 'ar'

  return (
    <div className="dark min-h-screen bg-slate-950 text-white" dir={isRtl ? 'rtl' : 'ltr'} lang={lang === 'ar' ? 'ar' : 'en'}>
      <AppNav
        variant="landing"
        signInLabel={t('Sign in', 'تسجيل الدخول')}
        getStartedLabel={t('Get started', 'ابدأ مجاناً')}
        trailingElement={<LanguageSwitcher />}
      />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-800/50">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(245,158,11,0.1),transparent)]" />
          <div className="container relative mx-auto px-4 py-16 md:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm font-medium text-amber-400">
                {t('Simple, transparent pricing', 'أسعار بسيطة وواضحة')}
              </p>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                {t('Pricing', 'الأسعار')}
              </h1>
              <p className="mt-6 text-lg text-slate-400">
                {t(
                  'Start with a 30-day free trial. Then choose monthly or pay in advance. All plans include your menu, orders, and delivery setup.',
                  'ابدأ بتجربة مجانية 30 يوماً. ثم اختر الاشتراك الشهري أو الدفع مقدماً. كل الخطط تتضمن قائمتك والطلبات وإعداد التوصيل.'
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Trial + two options */}
        <section className="border-b border-slate-800/50 py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-4xl">
              {/* Free trial callout */}
              <div className="mb-12 flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-emerald-700/40 bg-emerald-950/30 px-6 py-5">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Zap className="size-6" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-200">
                    {t('30-day free trial', 'تجربة مجانية 30 يوماً')}
                  </h3>
                  <p className="text-sm text-emerald-200/80">
                    {t('Full access from day one. No credit card required.', 'وصول كامل من اليوم الأول. لا حاجة لبطاقة ائتمان.')}
                  </p>
                </div>
              </div>

              <div className="grid gap-8 lg:grid-cols-2">
                {/* Monthly subscription */}
                <div className="rounded-2xl border-2 border-amber-500/40 bg-slate-900/60 p-6 md:p-8">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                      <Calendar className="size-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">
                        {t('Monthly subscription', 'الاشتراك الشهري')}
                      </h2>
                      <p className="text-sm text-slate-400">
                        {t('Pay each month. Cancel anytime.', 'ادفع كل شهر. ألغِ متى شئت.')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-white">350</span>
                    <span className="text-slate-400">ILS</span>
                    <span className="text-slate-500">/ {t('month', 'شهر')}</span>
                  </div>
                  <ul className="mt-6 space-y-3">
                    {[
                      t('Your menu link & dashboard', 'رابط قائمتك ولوحة التحكم'),
                      t('Dine-in & delivery orders', 'طلبات جلوس وتوصيل'),
                      t('Delivery areas & driver requests', 'مناطق التوصيل وطلب السائقين'),
                      t('Cancel anytime', 'إلغاء في أي وقت'),
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                        <Check className="size-4 shrink-0 text-amber-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="mt-8 w-full bg-amber-500 text-slate-950 hover:bg-amber-400 focus-visible:ring-amber-500/30" size="lg">
                    <Link href="/sign-up?redirect_url=/">
                      {t('Start free trial', 'ابدأ التجربة المجانية')}
                    </Link>
                  </Button>
                </div>

                {/* Pay in advance */}
                <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 md:p-8">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
                      <CreditCard className="size-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">
                        {t('Pay in advance', 'الدفع مقدماً')}
                      </h2>
                      <p className="text-sm text-slate-400">
                        {t('Save more when you pay for 3, 6, or 12 months.', 'وفر أكثر عند الدفع مقابل 3 أو 6 أو 12 شهراً.')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 space-y-4">
                    {PLAN_ORDER.map((planId) => {
                      const plan = SUBSCRIPTION_PLANS[planId]
                      const label = lang === 'ar' ? plan.labelAr : plan.labelEn
                      const perMonth =
                        lang === 'ar'
                          ? `${plan.perMonthIls} ${t('ILS/month', 'شيكل/شهر')}`
                          : `${plan.perMonthIls} ILS/${t('month', 'شهر')}`
                      return (
                        <div
                          key={planId}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-800/50 px-4 py-3"
                        >
                          <span className="font-medium text-white">{label}</span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-bold text-white">{plan.priceIls} ILS</span>
                            <span className="text-xs text-slate-500">{perMonth}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <ul className="mt-6 space-y-3">
                    {[
                      t('Same features as monthly', 'نفس المميزات كالاشتراك الشهري'),
                      t('Pay once via PayPal', 'ادفع مرة عبر PayPal'),
                      t('No renewal until period ends', 'بدون تجديد حتى نهاية المدة'),
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                        <Check className="size-4 shrink-0 text-sky-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant="outline" className="mt-8 w-full border-slate-600 bg-slate-800 text-white hover:bg-slate-700" size="lg">
                    <Link href="/sign-up?redirect_url=/">
                      {t('Start free trial', 'ابدأ التجربة المجانية')}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ / note */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl rounded-2xl border border-slate-700/60 bg-slate-900/40 p-6 md:p-8">
              <div className="flex gap-4">
                <HelpCircle className="size-6 shrink-0 text-slate-500" />
                <div>
                  <h3 className="font-semibold text-white">
                    {t('How payment works', 'كيف يعمل الدفع')}
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">
                    {t(
                      'After your free trial, go to Billing in your dashboard. Choose monthly (Subscribe with PayPal) or a one-time plan (1, 3, 6, or 12 months). Payment is via PayPal. Your business stays visible to customers as long as your subscription is active.',
                      'بعد التجربة المجانية، اذهب إلى الفوترة في لوحة التحكم. اختر شهري (الاشتراك عبر PayPal) أو خطة لمرة واحدة (1، 3، 6 أو 12 شهراً). الدفع عبر PayPal. يبقى مشروعك ظاهراً للعملاء طالما اشتراكك نشط.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-slate-800/50 py-16 md:py-20">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">
              {t('Start with a free trial', 'ابدأ بتجربة مجانية')}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-slate-400">
              {t('No credit card required. Full access for 30 days.', 'لا حاجة لبطاقة ائتمان. وصول كامل لمدة 30 يوماً.')}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Button asChild size="lg" className="h-12 gap-2 bg-amber-500 px-6 text-slate-950 hover:bg-amber-400">
                <Link href="/sign-up?redirect_url=/">
                  <Store className="size-5" />
                  {t('Get started', 'ابدأ الآن')}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-slate-600 text-slate-300 hover:bg-slate-800">
                <Link href="/product" className="inline-flex items-center gap-2">
                  {t('Learn more', 'اعرف المزيد')}
                  <ChevronRight className="size-4" style={isRtl ? { transform: 'scaleX(-1)' } : undefined} />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
