'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AppNav } from '@/components/saas/AppNav'
import { PublicFooter } from '@/components/saas/PublicFooter'
import { useLanguage } from '@/components/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import {
  Store,
  Menu,
  Smartphone,
  Zap,
  Globe,
  Shield,
  BarChart3,
  MapPin,
  Truck,
  Clock,
  UserCheck,
  CreditCard,
  Check,
  UserPlus,
  LogIn,
} from 'lucide-react'

export function ProductPageClient() {
  const { lang, t } = useLanguage()
  const isRtl = lang === 'ar'

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
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(245,158,11,0.12),transparent)]" />
          <div className="container relative mx-auto px-4 py-16 md:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm font-medium text-amber-400">
                {t('For restaurants, cafes & small businesses', 'للمطاعم والمقاهي والمشاريع الصغيرة')}
              </p>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                {t('Everything you need to run orders — in one place', 'كل ما تحتاجه لإدارة الطلبات — في مكان واحد')}
              </h1>
              <p className="mt-6 text-lg text-slate-400">
                {t(
                  'One subscription. Your digital menu. Dine-in and delivery. No per-order fees, no third-party apps.',
                  'اشتراك واحد. قائمتك الرقمية. جلوس وتوصيل. بدون رسوم لكل طلب، بدون تطبيقات طرف ثالث.'
                )}
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Button asChild size="lg" className="h-12 gap-2 bg-amber-500 px-6 text-slate-950 hover:bg-amber-400 focus-visible:ring-amber-500/30">
                  <Link href="/pricing">
                    <CreditCard className="size-5" />
                    {t('See pricing', 'عرض الأسعار')}
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 border-slate-600 bg-slate-800/80 text-white hover:bg-slate-700 hover:text-white">
                  <Link href="/sign-up?redirect_url=/">{t('Start free trial', 'ابدأ التجربة المجانية')}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* For businesses — restaurants & cafes */}
        <section className="border-b border-slate-800/50 py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
                <Store className="size-7" />
              </div>
              <h2 className="mt-6 text-2xl font-bold md:text-3xl">
                {t('For business owners', 'لأصحاب الأعمال')}
              </h2>
              <p className="mt-3 text-slate-400">
                {t(
                  'Built for restaurants, cafes, salons, and any business that takes orders. Get online in minutes.',
                  'مصمم للمطاعم والمقاهي والصالونات وأي مشروع يستقبل طلبات. انطلق أونلاين خلال دقائق.'
                )}
              </p>
            </div>
            <div className="mx-auto mt-14 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Menu,
                  title: t('Your digital menu', 'قائمتك الرقمية'),
                  desc: t('One link. Categories, items, prices, and photos. No app store, no printing.', 'رابط واحد. تصنيفات وأصناف وأسعار وصور. بدون متجر تطبيقات أو طباعة.'),
                  color: 'bg-amber-500/20 text-amber-400',
                },
                {
                  icon: Zap,
                  title: t('Dine-in & delivery', 'جلوس وتوصيل'),
                  desc: t('Accept both order types. Set delivery areas and fees. One dashboard for everything.', 'استقبل النوعين. حدد مناطق التوصيل والرسوم. لوحة واحدة لكل شيء.'),
                  color: 'bg-sky-500/20 text-sky-400',
                },
                {
                  icon: Globe,
                  title: t('Bilingual ready', 'ثنائي اللغة'),
                  desc: t('English and Arabic. Reach more customers without extra work.', 'إنجليزي وعربي. الوصول لمزيد من العملاء بدون جهد إضافي.'),
                  color: 'bg-emerald-500/20 text-emerald-400',
                },
                {
                  icon: BarChart3,
                  title: t('Orders & analytics', 'الطلبات والتحليلات'),
                  desc: t('See all orders in one place. Track what sells and when.', 'شاهد كل الطلبات في مكان واحد. تتبع الأكثر مبيعاً والتوقيت.'),
                  color: 'bg-violet-500/20 text-violet-400',
                },
                {
                  icon: MapPin,
                  title: t('Delivery areas', 'مناطق التوصيل'),
                  desc: t('Define your delivery zones and fees. Customers see only what you offer.', 'حدد مناطق التوصيل والرسوم. العملاء يرون فقط ما تقدمه.'),
                  color: 'bg-rose-500/20 text-rose-400',
                },
                {
                  icon: Shield,
                  title: t('One flat fee', 'رسوم ثابتة واحدة'),
                  desc: t('Monthly subscription. No per-order charges. Predictable costs.', 'اشتراك شهري. بدون رسوم لكل طلب. تكاليف متوقعة.'),
                  color: 'bg-amber-500/20 text-amber-400',
                },
              ].map(({ icon: Icon, title, desc, color }) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 transition-colors hover:border-slate-700"
                >
                  <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${color}`}>
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{title}</h3>
                    <p className="mt-1.5 text-sm text-slate-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* For drivers */}
        <section className="border-b border-slate-800/50 py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-4xl rounded-2xl border border-emerald-700/40 bg-gradient-to-br from-emerald-950/50 to-slate-900/50 p-8 md:p-12">
              <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:text-left">
                <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                  <Truck className="size-8" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold md:text-3xl">
                    {t('For drivers', 'للسائقين')}
                  </h2>
                  <p className="mt-3 text-slate-400">
                    {t(
                      'Work directly with local businesses. No third-party platform. Get orders, deliver, and get paid — with full control.',
                      'اعمل مباشرة مع الأعمال المحلية. بدون منصة طرف ثالث. استلم الطلبات ووصّل واحصل على أجرك — مع تحكم كامل.'
                    )}
                  </p>
                </div>
              </div>
              <ul className="mt-10 grid gap-4 sm:grid-cols-2">
                {[
                  { icon: UserCheck, text: t('No middleman — work directly with restaurants and cafes', 'بدون وسيط — اعمل مباشرة مع المطاعم والمقاهي') },
                  { icon: Clock, text: t('Start right away — sign up, complete profile, go online', 'ابدأ فوراً — سجّل، أكمل الملف، اختر متصل') },
                  { icon: Smartphone, text: t('Dedicated driver app — orders, navigation, history', 'تطبيق سائق مخصص — طلبات، تنقل، سجل') },
                  { icon: MapPin, text: t('Your area — see orders near you and accept what works', 'منطقتك — شاهد الطلبات القريبة واقبل ما يناسبك') },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 rounded-xl bg-slate-800/40 p-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                      <Icon className="size-4" />
                    </div>
                    <span className="text-sm text-slate-300">{text}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-10 flex flex-wrap gap-4">
                <Button asChild size="lg" className="h-12 gap-2 bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:ring-emerald-500/30">
                  <Link href="/sign-up?redirect_url=/">
                    <UserPlus className="size-5" />
                    {t('Become a driver', 'انضم كسائق')}
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 border-slate-600 bg-slate-800/80 text-white hover:bg-slate-700">
                  <Link href="/sign-in?redirect_url=/driver">
                    <LogIn className="size-5" />
                    {t('Driver sign in', 'دخول السائق')}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">
              {t('Ready to get started?', 'مستعد للبدء؟')}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-slate-400">
              {t('Start your free trial. No credit card required.', 'ابدأ تجربتك المجانية. لا حاجة لبطاقة ائتمان.')}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Button asChild size="lg" className="h-12 bg-amber-500 px-6 text-slate-950 hover:bg-amber-400">
                <Link href="/sign-up?redirect_url=/">{t('Start free trial', 'ابدأ التجربة المجانية')}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-slate-600 bg-transparent text-slate-300 hover:bg-slate-800">
                <Link href="/pricing">{t('View pricing', 'عرض الأسعار')}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
