'use client'

import Image from 'next/image'
import { isStandaloneMode } from '@/lib/pwa/detect'

export type PWAAppKind = 'driver' | 'business'

type TFn = (en: string, ar: string) => string

/** App Store–style layout (black pill, two-line headline); PWA install for Bedi — not third-party stores. */
const badgeBase =
  'group flex w-full min-h-[52px] items-center gap-3 rounded-xl border border-zinc-600/90 bg-black px-3.5 py-3 shadow-lg transition-[transform,box-shadow] duration-[var(--m3-duration-short)] ease-[var(--m3-ease-standard)] hover:border-zinc-500 hover:shadow-xl active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 touch-manipulation sm:min-h-[48px] sm:px-3 sm:py-2.5'

const LOGOS = {
  business: { src: '/adminslogo.webp', altEn: 'Bedi Business', altAr: 'بدي للأعمال' },
  driver: { src: '/driversLogo.webp', altEn: 'Bedi Driver', altAr: 'بدي للسائق' },
} as const

export function PWAStoreStyleBadge({
  href,
  appKind,
  onStandaloneBlocked,
  onBeforeNavigate,
  t,
}: {
  href: string
  appKind: PWAAppKind
  onStandaloneBlocked: (kind: PWAAppKind) => void
  onBeforeNavigate?: () => void
  t: TFn
}) {
  const logo = LOGOS[appKind]

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onBeforeNavigate?.()
    if (isStandaloneMode()) {
      e.preventDefault()
      onStandaloneBlocked(appKind)
    }
  }

  const appTitle =
    appKind === 'business'
      ? t('Bedi Business', 'بدي للأعمال')
      : t('Bedi Driver', 'بدي للسائق')

  const aria = t(`Install ${logo.altEn} web app`, `تثبيت تطبيق ${logo.altAr}`)

  return (
    <a
      href={href}
      onClick={handleClick}
      dir="ltr"
      className={badgeBase}
      aria-label={aria}
    >
      <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
        <Image
          src={logo.src}
          alt=""
          width={40}
          height={40}
          className="object-contain"
          sizes="40px"
        />
      </div>
      <div className="min-w-0 flex-1 text-start">
        <div className="text-[10px] font-medium leading-tight text-zinc-400">
          {t('Download the app', 'نزّل التطبيق')}
        </div>
        <div className="text-[15px] font-semibold leading-tight tracking-tight text-white sm:text-[15px]">{appTitle}</div>
        <div className="mt-0.5 hidden text-[9px] font-medium leading-tight text-zinc-500 sm:mt-0.5 sm:block">
          {t('Add to Home Screen from your browser', 'أضِفه إلى الشاشة الرئيسية من المتصفح')}
        </div>
      </div>
    </a>
  )
}

/** @deprecated Use `PWAStoreStyleBadge` — single store-style button per card. */
export const PWAStoreBadgePair = PWAStoreStyleBadge
