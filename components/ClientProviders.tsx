'use client'

import { LanguageProvider, useLanguage } from '@/components/LanguageContext'
import { LocationProvider } from '@/components/LocationContext'
import { CartProvider } from '@/components/Cart/CartContext'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { ClerkProvider } from '@clerk/nextjs'
import { arSA, enUS } from '@clerk/localizations'

const clerkAppearance = {
  elements: {
    modalContent: 'rounded-2xl shadow-xl',
    headerTitle: 'text-xl font-bold',
    headerSubtitle: 'text-slate-600',
    formButtonPrimary: 'bg-emerald-600 hover:bg-emerald-500',
    footerActionLink: 'text-emerald-600 hover:text-emerald-500',
    socialButtonsBlockButton: 'rounded-xl border-slate-200',
    userButtonPopoverCard: 'z-[100]',
  },
  variables: {
    colorPrimary: '#059669',
  },
}

function ClerkWithLocale({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage()
  const locale = lang === 'en' ? enUS : arSA

  return (
    <ClerkProvider appearance={clerkAppearance} localization={locale}>
      {children}
    </ClerkProvider>
  )
}

/** Client-only providers. SanityLive is rendered separately in a Server Component. */
export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <ClerkWithLocale>
        <LocationProvider>
          <CartProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </CartProvider>
        </LocationProvider>
      </ClerkWithLocale>
    </LanguageProvider>
  )
}
