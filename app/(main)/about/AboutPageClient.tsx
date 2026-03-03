'use client'

import Link from 'next/link'
import { AppNav } from '@/components/saas/AppNav'
import { PublicFooter } from '@/components/saas/PublicFooter'
import { useLanguage } from '@/components/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ChevronLeft, ArrowRight } from 'lucide-react'

export function AboutPageClient() {
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
        <section className="relative overflow-hidden border-b border-slate-800/50">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(245,158,11,0.08),transparent)]" />
          <div className="container relative mx-auto px-4 py-10 md:py-14">
            <Link
              href="/join"
              className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-amber-400 focus:text-amber-400 focus:outline-none"
            >
              <ChevronLeft className="size-4 shrink-0" style={isRtl ? { transform: 'scaleX(-1)' } : undefined} />
              {t('Back to Bedi Delivery', 'العودة إلى Bedi Delivery')}
            </Link>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl lg:text-4xl">
              {t('About us', 'من نحن')}
            </h1>
            <p className="mt-6 text-lg text-slate-300">
              {t(
                'Bedi Delivery is a registered business providing on-demand delivery and menu services in Palestine, Jerusalem and Arab 48.',
                'Bedi Delivery شركة مسجلة تقدم خدمات التوصيل والقوائم عند الطلب في فلسطين والقدس وعرب 48.'
              )}
            </p>
            <p className="mt-4 text-slate-400">
              {t(
                'We run a modern SaaS platform that helps restaurants, cafes, salons, and other businesses go online in minutes: one shareable link for your digital menu, dine-in and delivery orders, and a network of delivery drivers. No app store, no printing—just a link you share with your customers. Bedi Delivery is built to be bilingual (English and Arabic) from the ground up, so you can reach more of your community.',
                'ندير منصة SaaS حديثة تساعد المطاعم والمقاهي والصالونات وغيرها من الأعمال على الانتقال أونلاين خلال دقائق: رابط واحد قابل للمشاركة لقائمتك الرقمية وطلبات الجلوس والتوصيل وشبكة من سائقي التوصيل. بدون متجر تطبيقات أو طباعة—فقط رابط تشاركه مع عملائك. Bedi Delivery مُصمَّمة لتكون ثنائية اللغة (إنجليزي وعربي) من الأساس، حتى يمكنك الوصول إلى المزيد من مجتمعك.'
              )}
            </p>
            <p className="mt-4 text-slate-400">
              {t(
                'Whether you are a business owner who wants to take orders online or a driver looking to join our delivery network, we are here to help. Get in touch or sign up to get started.',
                'سواء كنت صاحب عمل تريد استقبال الطلبات أونلاين أو سائقاً يريد الانضمام إلى شبكة التوصيل، نحن هنا لمساعدتك. تواصل معنا أو سجّل للبدء.'
              )}
            </p>
            <div className="mt-8">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 text-amber-400 transition-colors hover:text-amber-300 focus:text-amber-300 focus:outline-none"
              >
                {t('Contact us', 'تواصل معنا')}
                <ArrowRight className="size-4 shrink-0 opacity-70" style={isRtl ? { transform: 'scaleX(-1)' } : undefined} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
