import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getTenantBySlug, isTenantSubscriptionExpired } from '@/lib/tenant'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { AppNav } from '@/components/saas/AppNav'
import { BusinessPushStatusCard } from '@/components/push/BusinessPushStatusCard'
import { PWAManager } from '@/components/pwa/PWAManager'
import { ManageNavClient } from './ManageNavClient'
import { SubscriptionBanner } from './SubscriptionBanner'
import { ManageLanguageSync } from './ManageLanguageSync'
import { TenantManagePushWrapper } from './TenantManagePushWrapper'
import { TenantBusinessProvider } from './TenantBusinessContext'
import { enforcePhoneVerification } from '@/lib/enforce-phone'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  await params
  return {
    icons: {
      icon: '/adminslogo.webp',
      apple: '/adminslogo.webp',
    },
  }
}

export default async function ManageLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const auth = await checkTenantAuth(slug)
  if (!auth.ok) {
    if (auth.status === 404) redirect('/dashboard')
    redirect('/dashboard')
  }

  const tenant = await getTenantBySlug(slug, { useCdn: false })
  await enforcePhoneVerification(`/t/${slug}/manage`)

  let subscriptionStatus = tenant?.subscriptionStatus ?? 'trial'
  if (tenant && isTenantSubscriptionExpired(tenant) && (subscriptionStatus === 'active' || subscriptionStatus === 'trial')) {
    if (token) {
      try {
        const writeClient = client.withConfig({ token, useCdn: false })
        await writeClient.patch(tenant._id).set({ subscriptionStatus: 'past_due' }).commit()
      } catch (e) {
        console.warn('[manage layout] Failed to set past_due:', e)
      }
    }
    subscriptionStatus = 'past_due'
  }
  const subscriptionBannerInitial = tenant
    ? {
        subscriptionExpiresAt: tenant.subscriptionExpiresAt ?? null,
        createdAt: tenant.createdAt ?? null,
        subscriptionStatus,
      }
    : null

  const permissions = auth.ok ? auth.permissions : []
  const subscriptionPlan = (tenant?.subscriptionPlan as 'basic' | 'pro' | 'ultra') ?? null

  return (
    <div className="dark min-h-screen flex flex-col bg-slate-950 text-white">
      <AppNav variant="dashboard" />

      <TenantManagePushWrapper slug={slug}>
        <TenantBusinessProvider slug={slug}>
        <div className="flex-1 mx-auto w-full max-w-[1400px] flex flex-col">
          {/* Utility Components out of the flex-row flow */}
          <PWAManager role="business-manage" slug={slug} variant="inline" hideInstall />
          <ManageLanguageSync slug={slug} />

          <div className="flex-1 flex flex-col md:flex-row w-full">
            {/* Sidebar / Mobile Nav */}
            <aside className="md:w-64 lg:w-72 md:shrink-0 md:border-r md:border-slate-800/60 md:py-8 md:px-2 md:sticky md:top-[73px] md:h-[calc(100vh-73px)] md:overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <ManageNavClient slug={slug} permissions={permissions} subscriptionPlan={subscriptionPlan} />
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 px-4 py-5 sm:px-6 sm:py-8 md:py-8 md:px-8 lg:px-12">
              <SubscriptionBanner slug={slug} initialData={subscriptionBannerInitial} />
              <div className="pb-12">
                {children}
              </div>
              <BusinessPushStatusCard slug={slug} />
            </main>
          </div>
        </div>
        </TenantBusinessProvider>
      </TenantManagePushWrapper>
    </div>
  )
}
