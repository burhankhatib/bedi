'use client'

import Image from 'next/image'
import { isStandaloneMode } from '@/lib/pwa/detect'

export type PWAAppKind = 'driver' | 'business' | 'customer'

type TFn = (en: string, ar: string) => string

/** App Store–style layout (black pill, two-line headline); PWA install for Bedi — not third-party stores. */
const badgeBase =
  'group flex w-full min-h-[52px] items-center gap-3 rounded-xl border border-zinc-600/90 bg-black px-3.5 py-3 shadow-lg transition-[transform,box-shadow] duration-[var(--m3-duration-short)] ease-[var(--m3-ease-standard)] hover:border-zinc-500 hover:shadow-xl active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 touch-manipulation sm:min-h-[48px] sm:px-3 sm:py-2.5'

const LOGOS = {
  customer: { src: '/customersLogo.webp', altEn: 'Bedi', altAr: 'بدي' },
  business: { src: '/adminslogo.webp', altEn: 'Bedi Business', altAr: 'بدي للأعمال' },
  driver: { src: '/driversLogo.webp', altEn: 'Bedi Driver', altAr: 'بدي للسائق' },
} as const

export function PWAStoreStyleBadge({
  href,
  apkUrl,
  appKind,
  onStandaloneBlocked,
  onBeforeNavigate,
  t,
}: {
  href: string
  apkUrl?: string
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
      : appKind === 'driver'
      ? t('Bedi Driver', 'بدي للسائق')
      : t('Bedi', 'بدي')

  const aria = t(`Install ${logo.altEn} web app`, `تثبيت تطبيق ${logo.altAr}`)

  return (
    <div className="flex flex-col gap-2">
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

      {apkUrl && (
        <a
          href={apkUrl}
          download
          dir="ltr"
          className={badgeBase}
          aria-label={t(`Download ${logo.altEn} APK`, `تنزيل ${logo.altAr} APK`)}
        >
          <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
            <svg className="size-6 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.5,2.1C3.2,2.4 3,3 3,3.7V20.3C3,21 3.2,21.6 3.5,21.9L3.6,22L14.3,11.3L14.4,11.2L14.3,11.1L3.6,0.4L3.5,0.5L3.5,2.1Z" fill="#4CAF50"/>
              <path d="M17.9,14.8L14.4,11.2L14.4,11.1L14.4,11L17.9,7.5L18,7.6L21.3,9.5C22.2,10 22.2,10.9 21.3,11.4L18,13.3L17.9,14.8Z" fill="#FFC107"/>
              <path d="M14.4,11.2L3.5,21.9C3.9,22.3 4.5,22.3 5.3,21.9L17.9,14.8L14.4,11.2Z" fill="#F44336"/>
              <path d="M14.4,11.1L3.5,0.5C3.9,0.1 4.5,0 5.3,0.5L17.9,7.5L14.4,11.1Z" fill="#2196F3"/>
            </svg>
          </div>
          <div className="min-w-0 flex-1 text-start">
            <div className="text-[10px] font-medium leading-tight text-zinc-400">
              {t('Get it on', 'احصل عليه من')}
            </div>
            <div className="text-[15px] font-semibold leading-tight tracking-tight text-white sm:text-[15px]">Android APK</div>
            <div className="mt-0.5 hidden text-[9px] font-medium leading-tight text-zinc-500 sm:mt-0.5 sm:block">
              {t('Download direct APK file', 'تنزيل ملف APK المباشر')}
            </div>
          </div>
        </a>
      )}
    </div>
  )
}

/** @deprecated Use `PWAStoreStyleBadge` — single store-style button per card. */
export const PWAStoreBadgePair = PWAStoreStyleBadge
