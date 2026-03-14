'use client'

import { PushStatusCard } from './PushStatusCard'
import { useTenantPush } from '@/app/(main)/t/[slug]/manage/TenantPushContext'
import { getTenantDashboardPWAConfig } from '@/lib/pwa/configs'

export function BusinessPushStatusCard({ slug }: { slug: string }) {
  const { tokenStatus, loading, isDenied, needsIOSHomeScreen, subscribe, refreshToken } = useTenantPush()
  const status = tokenStatus
  return (
    <PushStatusCard
      variant="business"
      slug={slug}
      status={status}
      loading={loading}
      isDenied={isDenied}
      needsIOSHomeScreen={needsIOSHomeScreen}
      onSubscribe={() => subscribe()}
      onRefresh={() => refreshToken()}
      pwaConfig={getTenantDashboardPWAConfig()}
    />
  )
}
