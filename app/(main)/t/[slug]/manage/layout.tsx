import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { checkTenantAuth } from '@/lib/tenant-auth'
import { getTenantBySlug, isTenantSubscriptionExpired } from '@/lib/tenant'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'
import { AppNav } from '@/components/saas/AppNav'
import { TenantDashboardPWA } from '@/components/TenantDashboardPWA'
import { TenantPushSetup } from '@/components/TenantPushSetup'
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt'
import { ManageNavClient } from './ManageNavClient'
import { SubscriptionBanner } from './SubscriptionBanner'
import { ManageLanguageSync } from './ManageLanguageSync'
import { TenantManagePushWrapper } from './TenantManagePushWrapper'
import { TenantBusinessProvider } from './TenantBusinessContext'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  return {
    manifest: `/t/${slug}/manage/manifest.webmanifest`,
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

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-950 text-white">
      <AppNav variant="dashboard" />

      <TenantManagePushWrapper slug={slug}>
        <TenantBusinessProvider slug={slug}>
        <main className="mx-auto max-w-[100vw] px-4 py-5 sm:container sm:px-6 sm:py-8 md:py-10">
          <PWAUpdatePrompt
            scriptUrl={`/t/${slug}/manage/sw.js`}
            scope={`/t/${slug}/manage`}
            titleEn="New version available"
            titleAr="يتوفر إصدار جديد"
            reloadEn="Reload to update"
            reloadAr="تحديث الآن"
          />
          <TenantDashboardPWA slug={slug} scope={`/t/${slug}/manage`} />
          <ManageLanguageSync slug={slug} />
          <ManageNavClient slug={slug} permissions={permissions} />
          <SubscriptionBanner slug={slug} initialData={subscriptionBannerInitial} />
          <TenantPushSetup slug={slug} scope={`/t/${slug}/manage`} />

          <div className="min-w-0 pb-8">
            {children}
          </div>
        </main>
        </TenantBusinessProvider>
      </TenantManagePushWrapper>
    </div>
  )
}
