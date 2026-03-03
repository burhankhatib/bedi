'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AppNav } from '@/components/saas/AppNav'
import { PublicFooter } from '@/components/saas/PublicFooter'
import { HomePageStatsSection } from '@/components/saas/HomePageStatsSection'
import {
  Store,
  ArrowRight,
  Menu,
  Smartphone,
  Check,
  Zap,
  Shield,
  Globe,
  Truck,
  LogIn,
  UserPlus,
} from 'lucide-react'
import type { HomePageStats } from '@/lib/home-stats'
import { useLanguage } from '@/components/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export function JoinPageClient({ stats }: { stats: HomePageStats }) {
  const { lang, t } = useLanguage()
  const isRtl = lang === 'ar'

  const tagline = t(
    `© 2026 Bedi Delivery. All rights reserved.`,
    `© 2026 Bedi Delivery. جميع الحقوق محفوظة.`
  )

  return (
    <div className="min-h-screen bg-slate-950 text-white" dir={isRtl ? 'rtl' : 'ltr'} lang={lang === 'ar' ? 'ar' : 'en'}>
      <AppNav
        variant="landing"
        signInLabel={t('Sign in', 'تسجيل الدخول')}
        getStartedLabel={t('Get started', 'ابدأ مجاناً')}
        trailingElement={<LanguageSwitcher />}
      />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-800/50">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(245,158,11,0.15),transparent)]" />
          <div className="container relative mx-auto px-4 py-20 md:py-28 lg:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm font-medium text-amber-400">
                {t('For restaurants, cafes, salons & more', 'للمطاعم والمقاهي والصالونات والمزيد')}
              </p>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                {t('One link. Your menu. Orders that just work.', 'رابط واحد. قائمتك. طلبات تعمل ببساطة.')}
              </h1>
              <p className="mt-6 text-lg text-slate-400 md:text-xl">
                {t(
                  'Create your digital menu in minutes. Accept dine-in and delivery orders from one place. No app store, no printing — just a link you share.',
                  'أنشئ قائمتك الرقمية خلال دقائق. استقبل طلبات الجلوس والتوصيل من مكان واحد. بدون متجر تطبيقات أو طباعة — فقط رابط تشاركه.'
                )}
              </p>
              <div className="mt-10 flex flex-col items-center gap-4">
                <p className="text-sm font-medium text-slate-400">
                  {t('Sign in or sign up as Business or Driver — we’ll send you to the right dashboard.', 'سجّل الدخول أو أنشئ حساباً كأعمال أو سائق — سنوجّهك للوحة التحكم المناسبة.')}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button asChild size="lg" className="h-12 gap-2 bg-amber-500 px-6 text-slate-950 hover:bg-amber-400">
                    <Link href="/sign-up?redirect_url=/">
                      <Store className="size-5" />
                      {t('Sign up (Business)', 'تسجيل (أعمال)')}
                    </Link>
                  </Button>
                  <Button asChild size="lg" className="h-12 gap-2 border border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                    <Link href="/sign-in?redirect_url=/">{t('Sign in (Business)', 'دخول (أعمال)')}</Link>
                  </Button>
                  <Button asChild size="lg" className="h-12 gap-2 bg-emerald-600 px-6 hover:bg-emerald-500">
                    <Link href="/sign-up?redirect_url=/">
                      <Truck className="size-5" />
                      {t('Sign up (Driver)', 'تسجيل (سائق)')}
                    </Link>
                  </Button>
                  <Button asChild size="lg" className="h-12 gap-2 border border-emerald-500/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50">
                    <Link href="/sign-in?redirect_url=/driver">
                      <Truck className="size-5" />
                      {t('Sign in (Driver)', 'دخول (سائق)')}
                    </Link>
                  </Button>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-500">{t('No credit card required.', 'لا حاجة لبطاقة ائتمان.')}</p>
            </div>
          </div>
        </section>

        <HomePageStatsSection stats={stats} t={t} lang={lang} />

        {/* How it works */}
        <section id="how-it-works" className="border-b border-slate-800/50 py-16 md:py-24">
          <div className="container mx-auto px-4">
            <h2 className="text-center text-2xl font-bold md:text-3xl">{t('How it works', 'كيف يعمل')}</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-slate-400">
              {t('Get from sign-up to your first order in three steps.', 'من التسجيل إلى أول طلب في ثلاث خطوات.')}
            </p>
            <div className="mx-auto mt-14 grid max-w-4xl gap-10 md:grid-cols-3">
              {[
                {
                  step: '1',
                  title: t('Create your account', 'أنشئ حسابك'),
                  description: t(
                    'Sign up, pick your business type (restaurant, cafe, salon, etc.), and name your site.',
                    'سجّل، اختر نوع نشاطك (مطعم، مقهى، صالون، إلخ)، وسمّ موقعك.'
                  ),
                  icon: Store,
                },
                {
                  step: '2',
                  title: t('Build your menu', 'ابنِ قائمتك'),
                  description: t(
                    'Use your control panel to add categories, items, prices, and your branding.',
                    'استخدم لوحة التحكم لإضافة التصنيفات والأصناف والأسعار وشعارك.'
                  ),
                  icon: Menu,
                },
                {
                  step: '3',
                  title: t('Share & take orders', 'شارك واستقبل الطلبات'),
                  description: t(
                    'Share your link. Customers browse and order; you see everything in one dashboard.',
                    'شارك رابطك. الزبائن يتصفحون ويطلبون؛ أنت ترى كل شيء في لوحة واحدة.'
                  ),
                  icon: Smartphone,
                },
              ].map(({ step, title, description, icon: Icon }) => (
                <div key={step} className="relative text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                    <Icon className="size-6" />
                  </div>
                  <span className="mt-4 block text-sm font-semibold text-amber-400">{t('Step', 'الخطوة')} {step}</span>
                  <h3 className="mt-1 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-b border-slate-800/50 py-16 md:py-24">
          <div className="container mx-auto px-4">
            <h2 className="text-center text-2xl font-bold md:text-3xl">{t('Built for small businesses', 'مصمم للمشاريع الصغيرة')}</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-slate-400">
              {t('Everything you need to go digital, without the complexity.', 'كل ما تحتاجه للانتقال إلى الرقمي، بدون تعقيد.')}
            </p>
            <div className="mx-auto mt-14 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Zap, title: t('Dine-in & delivery', 'جلوس وتوصيل'), desc: t('One menu, both order types. Set delivery areas and fees.', 'قائمة واحدة ونوعا الطلبات. حدد مناطق التوصيل والرسوم.') },
                { icon: Globe, title: t('Bilingual ready', 'ثنائي اللغة'), desc: t('English and Arabic support so you can serve more customers.', 'دعم الإنجليزية والعربية لخدمة المزيد من الزبائن.') },
                { icon: Shield, title: t('Subscription-based', 'اشتراك شهري'), desc: t('One monthly plan. No per-order fees. Scale when you\'re ready.', 'خطة شهرية واحدة. بدون رسوم لكل طلب. انمُ عندما تكون جاهزاً.') },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 transition-colors hover:border-slate-700"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-amber-400">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* For Drivers */}
        <section id="for-drivers" className="border-b border-slate-800/50 py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl rounded-2xl border border-slate-700/60 bg-slate-900/50 p-8 md:p-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Truck className="size-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold md:text-3xl">{t('For Drivers', 'للسائقين')}</h2>
                  <p className="mt-0.5 text-slate-400">
                    {t('Deliver orders and earn. Create an account or sign in to the driver app.', 'وصّل الطلبات واربح. أنشئ حساباً أو سجّل الدخول لتطبيق السائق.')}
                  </p>
                </div>
              </div>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button asChild size="lg" className="h-12 gap-2 bg-emerald-600 px-6 text-white hover:bg-emerald-500">
                  <Link href="/sign-up?redirect_url=/">
                    <UserPlus className="size-5" />
                    {t('Create driver account', 'إنشاء حساب سائق')}
                  </Link>
                </Button>
                <Button asChild size="lg" className="h-12 gap-2 border border-slate-600 bg-slate-800 text-white hover:bg-slate-700" variant="outline">
                  <Link href="/sign-in?redirect_url=/driver/orders">
                    <LogIn className="size-5" />
                    {t('Login to driver app', 'تسجيل الدخول لتطبيق السائق')}
                  </Link>
                </Button>
              </div>
              <p className="mt-4 text-sm text-slate-500">
                {t('New drivers: sign up then complete your profile. Existing drivers: sign in to see orders.', 'السائقون الجدد: سجّل ثم أكمل ملفك. السائقون الحاليون: سجّل الدخول لرؤية الطلبات.')}
              </p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-b border-slate-800/50 py-16 md:py-24">
          <div className="container mx-auto px-4">
            <h2 className="text-center text-2xl font-bold md:text-3xl">{t('Simple pricing', 'أسعار بسيطة')}</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-slate-400">
              {t('Start with a free trial. One plan when you\'re ready.', 'ابدأ بتجربة مجانية. خطة واحدة عندما تكون جاهزاً.')}
            </p>
            <div className="mx-auto mt-14 max-w-md">
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-8">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-3xl font-bold">{t('Free trial', 'تجربة مجانية')}</span>
                  <span className="text-slate-500">{t('then', 'ثم')}</span>
                </div>
                <p className="mt-2 text-slate-400">
                  {t(
                    'One flat monthly fee. No per-order charges. Full access to menu, orders, and delivery setup.',
                    'رسوم شهرية ثابتة. بدون رسوم لكل طلب. وصول كامل للقائمة والطلبات وإعداد التوصيل.'
                  )}
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    t('Your own menu link', 'رابط قائمتك الخاص'),
                    t('Dine-in & delivery orders', 'طلبات جلوس وتوصيل'),
                    t('Orders dashboard', 'لوحة الطلبات'),
                    t('Delivery areas & drivers', 'مناطق التوصيل والسائقون'),
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                      <Check className="size-4 shrink-0 text-amber-500" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-8 w-full bg-amber-500 text-slate-950 hover:bg-amber-400" size="lg">
                  <Link href="/sign-up">{t('Get started', 'ابدأ الآن')}</Link>
                </Button>
                <p className="mt-4 text-center">
                  <Link href="/pricing" className="text-sm text-amber-400 hover:text-amber-300 underline underline-offset-2">
                    {t('See full pricing (monthly & pay in advance)', 'عرض الأسعار الكاملة (شهري ودفع مقدماً)')} →
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">{t('Ready to go digital?', 'مستعد للانتقال إلى الرقمي؟')}</h2>
            <p className="mx-auto mt-3 max-w-md text-slate-400">
              {t('Join businesses already using Bedi Delivery to run their menu and orders.', 'انضم إلى الأعمال التي تستخدم Bedi Delivery لإدارة قوائمها وطلباتها.')}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Button asChild size="lg" className="bg-amber-500 text-slate-950 hover:bg-amber-400">
                <Link href="/sign-up">{t('Start free trial', 'ابدأ التجربة المجانية')}</Link>
              </Button>
              <Button asChild size="lg" className="border border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                <Link href="/sign-in">{t('Sign in', 'تسجيل الدخول')}</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-800">
                <Link href="/join#for-drivers">
                  <Truck className={isRtl ? 'ml-2' : 'mr-2'} style={isRtl ? { transform: 'scaleX(-1)' } : undefined} size={20} />
                  {t('For drivers', 'للسائقين')}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter tagline={tagline} />
    </div>
  )
}
