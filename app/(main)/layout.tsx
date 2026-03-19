import { Suspense } from 'react'
import { SanityLiveGate } from '@/components/SanityLiveGate'
import { CustomerAreaWrapper } from '@/components/customer/CustomerAreaWrapper'
import { StandaloneDriverRedirect, StandaloneTenantRedirect } from '@/components/StandaloneDriverRedirect'
import { LanguageProvider } from '@/components/LanguageContext'
import { PageSkeleton } from '@/components/loading'
import { PortalContainerProvider } from '@/components/ui/PortalContainerContext'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  icons: {
    icon: '/customersLogo.webp',
    apple: '/customersLogo.webp',
  },
}

/**
 * (main) layout: structure + SanityLive. ClerkProvider etc. are in root layout.
 * CustomerAreaWrapper adds mobile bottom nav and content padding on customer paths.
 * StandaloneDriverRedirect sends PWA opens at / to /driver when user prefers driver.
 * StandaloneTenantRedirect sends PWA opens at / to /dashboard when user prefers tenant.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <LanguageProvider>
      <PortalContainerProvider>
        <div className="min-h-screen overflow-x-clip">
          <StandaloneDriverRedirect />
          <StandaloneTenantRedirect />
          <Suspense fallback={<PageSkeleton />}>
            <CustomerAreaWrapper>
              {children}
            </CustomerAreaWrapper>
          </Suspense>
          <Suspense fallback={null}>
            <SanityLiveGate />
          </Suspense>
        </div>
      </PortalContainerProvider>
    </LanguageProvider>
  )
}
