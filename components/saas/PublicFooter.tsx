'use client'

import Link from 'next/link'
import { useLanguage } from '@/components/LanguageContext'
import {
  Store,
  CreditCard,
  Truck,
  Shield,
  Zap,
  Menu,
  UserPlus,
  LogIn,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface PublicFooterLink {
  label: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
}

interface PublicFooterProps {
  tagline?: string
}

export function PublicFooter({ tagline }: PublicFooterProps) {
  const { t, lang } = useLanguage()
  const isRtl = lang === 'ar'
  const year = new Date().getFullYear()

  const defaultTagline = t(
    `© 2026 Bedi Delivery. All rights reserved.`,
    `© 2026 Bedi Delivery. جميع الحقوق محفوظة.`
  )

  // Sections matching the website (join page structure)
  const productLinks: PublicFooterLink[] = [
    { label: t('Product', 'المنتج'), href: '/product' },
    { label: t('Pricing', 'الأسعار'), href: '/pricing' },
    { label: t('Download app', 'تحميل التطبيق'), href: '/download-app' },
  ]

  const howItWorksLinks: PublicFooterLink[] = [
    { label: t('About', 'من نحن'), href: '/about' },
    { label: t('Join', 'انضم'), href: '/join' },
    { label: t('How it works', 'كيف يعمل'), href: '/join#how-it-works' },
    { label: t('Features', 'المميزات'), href: '/join#features' },
    { label: t('Pricing', 'الأسعار'), href: '/join#pricing' },
    { label: t('Contact us', 'تواصل معنا'), href: '/contact' },
  ]

  const forDriversLinks: PublicFooterLink[] = [
    { label: t('For drivers', 'للسائقين'), href: '/join#for-drivers' },
    { label: t('Become a driver', 'انضم كسائق'), href: '/sign-up?redirect_url=/' },
    { label: t('Driver sign in', 'دخول السائق'), href: '/sign-in?redirect_url=/driver' },
  ]

  const legalLinks: PublicFooterLink[] = [
    { label: t('Terms', 'الشروط'), href: '/terms' },
    { label: t('Privacy', 'الخصوصية'), href: '/privacy' },
    { label: t('Business details', 'بيانات الأعمال'), href: '/privacy#business-details' },
    { label: t('Refund policy', 'الاسترداد'), href: '/refund-policy' },
  ]

  const LinkGroup = ({
    title,
    links,
    icon: TitleIcon,
  }: {
    title: string
    links: PublicFooterLink[]
    icon?: React.ComponentType<{ className?: string }>
  }) => (
    <div className="flex flex-col gap-4">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {TitleIcon && <TitleIcon className="size-3.5 shrink-0" />}
        {title}
      </h3>
      <ul className="space-y-2.5">
        {links.map(({ label, href }) => (
          <li key={href}>
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-sm text-neutral-400 transition-colors hover:text-amber-400 focus:text-amber-400 focus:outline-none"
            >
              {label}
              <ChevronRight
                className="size-3.5 shrink-0 opacity-70"
                style={isRtl ? { transform: 'scaleX(-1)' } : undefined}
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <footer className="w-full min-w-full max-w-[100vw] border-t border-neutral-800 bg-black" role="contentinfo">
      <div className="w-full px-4 py-14 md:px-6 md:py-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xl font-bold text-white transition-opacity hover:opacity-90 focus:opacity-90 focus:outline-none"
            >
              <Store className="size-6 shrink-0 text-amber-400" aria-hidden />
              Bedi Delivery
            </Link>
            <p className="mt-3 max-w-xs text-sm text-neutral-500">
              {t(
                'One link. Your menu. Orders that just work.',
                'رابط واحد. قائمتك. طلبات تعمل ببساطة.'
              )}
            </p>
          </div>

          {/* Product */}
          <LinkGroup
            title={t('Product', 'المنتج')}
            links={productLinks}
            icon={CreditCard}
          />

          {/* How it works (sections of the site) */}
          <LinkGroup
            title={t('How it works', 'كيف يعمل')}
            links={howItWorksLinks}
            icon={Zap}
          />

          {/* For drivers */}
          <LinkGroup
            title={t('For drivers', 'للسائقين')}
            links={forDriversLinks}
            icon={Truck}
          />

          {/* Login / Register — prominent on desktop */}
          <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <Menu className="size-3.5 shrink-0" />
              {t('Account', 'الحساب')}
            </h3>
            <div className="flex flex-col gap-3">
              <Button
                asChild
                size="sm"
                className="w-full border border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700 focus-visible:ring-neutral-500"
              >
                <Link href="/sign-in?redirect_url=/" className="inline-flex items-center justify-center gap-2">
                  <LogIn className="size-4 shrink-0" />
                  {t('Sign in', 'تسجيل الدخول')}
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="w-full bg-amber-500 text-slate-950 hover:bg-amber-400 focus-visible:ring-amber-500/30"
              >
                <Link href="/sign-up?redirect_url=/" className="inline-flex items-center justify-center gap-2">
                  <UserPlus className="size-4 shrink-0" />
                  {t('Get started', 'ابدأ مجاناً')}
                </Link>
              </Button>
            </div>
          </div>

          {/* Legal */}
          <LinkGroup
            title={t('Legal', 'قانوني')}
            links={legalLinks}
            icon={Shield}
          />
        </div>

        <div className="mx-auto mt-12 flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-neutral-800 pt-8 md:flex-row md:gap-0">
          <p className="text-center text-xs text-neutral-500 md:text-left">
            {tagline ?? defaultTagline}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-neutral-500">
            <Link href="/terms" className="hover:text-neutral-400">
              {t('Terms', 'الشروط')}
            </Link>
            <Link href="/privacy" className="hover:text-neutral-400">
              {t('Privacy', 'الخصوصية')}
            </Link>
            <Link href="/privacy#business-details" className="hover:text-neutral-400">
              {t('Business details', 'بيانات الأعمال')}
            </Link>
            <Link href="/refund-policy" className="hover:text-neutral-400">
              {t('Refunds', 'الاسترداد')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
