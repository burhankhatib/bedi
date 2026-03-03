'use client'

import Link from 'next/link'
import { AppNav } from '@/components/saas/AppNav'
import { PublicFooter } from '@/components/saas/PublicFooter'
import { useLanguage } from '@/components/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ChevronLeft } from 'lucide-react'

export const legalFooterLinks = [
  { labelEn: 'Terms & Conditions', labelAr: 'الشروط والأحكام', href: '/terms' },
  { labelEn: 'Privacy Policy', labelAr: 'سياسة الخصوصية', href: '/privacy' },
  { labelEn: 'Business details', labelAr: 'بيانات الأعمال', href: '/privacy#business-details' },
  { labelEn: 'Refund Policy', labelAr: 'سياسة الاسترداد', href: '/refund-policy' },
]

interface LegalPageLayoutProps {
  titleEn: string
  titleAr: string
  children: React.ReactNode
}

export function LegalPageLayout({ titleEn, titleAr, children }: LegalPageLayoutProps) {
  const { lang, t } = useLanguage()
  const isRtl = lang === 'ar'
  const title = isRtl ? titleAr : titleEn

  return (
    <div className="min-h-screen bg-slate-950 text-white" dir={isRtl ? 'rtl' : 'ltr'} lang={lang === 'ar' ? 'ar' : 'en'}>
      <AppNav
        variant="landing"
        signInLabel={t('Sign in', 'تسجيل الدخول')}
        getStartedLabel={t('Get started', 'ابدأ مجاناً')}
        trailingElement={<LanguageSwitcher />}
      />

      <main className="border-b border-slate-800/50">
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
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl lg:text-4xl">{title}</h1>
          </div>
        </section>

        <section className="py-10 md:py-14">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-slate-300">
              {children}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
