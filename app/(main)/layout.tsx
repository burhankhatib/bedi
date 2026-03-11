import { Suspense } from 'react'
import { SanityLiveGate } from '@/components/SanityLiveGate'
import { CustomerAreaWrapper } from '@/components/customer/CustomerAreaWrapper'
import { StandaloneDriverRedirect, StandaloneTenantRedirect } from '@/components/StandaloneDriverRedirect'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  manifest: '/manifest.json',
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
    <div className="min-h-screen overflow-x-hidden">
      <StandaloneDriverRedirect />
      <StandaloneTenantRedirect />
      <CustomerAreaWrapper>
        {children}
      </CustomerAreaWrapper>
      <Suspense fallback={null}>
        <SanityLiveGate />
      </Suspense>
    </div>
  )
}
