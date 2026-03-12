'use client'

/**
 * Wraps the Business Orders page with push context and non-blocking enable banner.
 * - Provider so we can check hasPush and call subscribe()
 * - Sticky banner when push disabled; page remains usable. FCM unchanged.
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
