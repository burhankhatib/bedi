'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AppNav } from '@/components/saas/AppNav'
import { PublicFooter } from '@/components/saas/PublicFooter'
import { useLanguage } from '@/components/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { SUBSCRIPTION_PLANS, type PlanId } from '@/lib/subscription'
import {
  Check,
  Zap,
  HelpCircle,
  Store,
  ChevronRight,
} from 'lucide-react'

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
                {/* Basic, Pro, Ultra plans */}
                <div className="grid gap-6 sm:grid-cols-3">
                  {(['basic', 'pro', 'ultra'] as const).map((tier) => {
                    const monthlyPlan = SUBSCRIPTION_PLANS[`${tier}-monthly` as PlanId]
                    const yearlyPlan = SUBSCRIPTION_PLANS[`${tier}-yearly` as PlanId]
                    const labelEn = { basic: 'Basic', pro: 'Pro', ultra: 'Ultra' }[tier]
                    const labelAr = { basic: 'باسيك', pro: 'برو', ultra: 'ألترا' }[tier]
                    return (
                      <div
                        key={tier}
                        className={`rounded-2xl border p-6 md:p-8 ${
                          tier === 'ultra'
                            ? 'border-2 border-amber-500/40 bg-slate-900/80'
                            : 'border-slate-700/60 bg-slate-900/60'
                        }`}
                      >
                        {tier === 'ultra' && (
                          <span className="mb-3 inline-block rounded-full bg-amber-500/20 px-3 py-0.5 text-xs font-semibold text-amber-400">
                            {t('Best value', 'الأفضل')}
                          </span>
                        )}
                        <h2 className="text-xl font-bold">
                          {t(labelEn, labelAr)}
                        </h2>
                        <div className="mt-4 flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-white">{monthlyPlan.priceIls}</span>
                          <span className="text-slate-400">ILS</span>
                          <span className="text-slate-500">/ {t('month', 'شهر')}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {t('Yearly', 'سنوي')}: {yearlyPlan.priceIls} ILS ({yearlyPlan.perMonthIls} {t('ILS/month', 'شيكل/شهر')})
                        </p>
                        <ul className="mt-6 space-y-2">
                          {(tier === 'basic'
                            ? [t('30 products max', '٣٠ منتجاً كحد أقصى'), t('Full menu & analytics', 'قائمة كاملة وتحليلات')]
                            : tier === 'pro'
                              ? [t('50 products max', '٥٠ منتجاً كحد أقصى'), t('Tables & Staff', 'الطاولات والموظفون'), t('Full menu & analytics', 'قائمة كاملة وتحليلات')]
                              : [t('Unlimited products', 'منتجات غير محدودة'), t('Tables & Staff', 'الطاولات والموظفون'), t('Full menu & analytics', 'قائمة كاملة وتحليلات')]
                          ).map((item) => (
                            <li key={item} className="flex items-center gap-2 text-sm text-slate-300">
                              <Check className="size-4 shrink-0 text-amber-500" />
                              {item}
                            </li>
                          ))}
                        </ul>
                        <Button asChild className="mt-8 w-full bg-amber-500 text-slate-950 hover:bg-amber-400" size="lg">
                          <Link href="/sign-up?redirect_url=/">
                            {tier === 'ultra' ? t('Start free trial', 'ابدأ التجربة المجانية') : t('Get started', 'ابدأ')}
                          </Link>
                        </Button>
                      </div>
                    )
                  })}
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
                      'After your free trial, go to Billing in your dashboard. Choose Basic, Pro, or Ultra. Pay monthly or yearly (11 months + 1 free) via Bank of Palestine or PayPal. Your business stays visible as long as your subscription is active.',
                      'بعد التجربة المجانية، اذهب إلى الفوترة في لوحة التحكم. اختر باسيك أو برو أو ألترا. ادفع شهرياً أو سنوياً (١١ شهراً + ١ مجاني) عبر بنك فلسطين أو PayPal. يبقى مشروعك ظاهراً طالما اشتراكك نشط.'
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
