'use client'

/**
 * Wraps the Business Orders page with the same push flow as the Driver:
 * - Provider so we can check hasPush and call subscribe()
 * - Full-screen gate every visit until push is enabled (FCM for new order alerts when app is closed)
 */
import { TenantPushProvider } from '../manage/TenantPushContext'
import { TenantOrdersGate } from '../manage/TenantOrdersGate'

export function OrdersPushGateWrapper({
  slug,
  children,
}: {
  slug: string
  children: React.ReactNode
}) {
  return (
    <TenantPushProvider slug={slug} scope={`/t/${slug}/orders/`}>
      <TenantOrdersGate slug={slug}>
        {children}
      </TenantOrdersGate>
    </TenantPushProvider>
  )
}
